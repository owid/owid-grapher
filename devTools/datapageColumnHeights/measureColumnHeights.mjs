// Measure the rendered height of the two columns of the "What you should know
// about this indicator" section across every data page on the site.
//
// Usage:
//   node devTools/datapageColumnHeights/measureColumnHeights.mjs [options]
//
//   --base <url>        site to sweep (default https://ourworldindata.org)
//   --out <path>        JSONL output, one line per page
//                       (default devTools/datapageColumnHeights/columnHeights.jsonl)
//   --summary <path>    summary statistics JSON
//                       (default alongside --out, with a .summary.json suffix)
//   --concurrency <n>   pages rendered in parallel (default 8)
//   --limit <n>         stop after n /grapher/ URLs (for a smoke run)
//
// See readme.md for what the numbers mean and why the two columns have to be
// measured by their content rather than by their grid items.
import { existsSync } from "node:fs"
import { mkdir, open, writeFile } from "node:fs/promises"
import path from "node:path"
import { chromium, request } from "@playwright/test"

// Desktop width. The two columns only sit side by side at desktop widths; the
// layout stacks on narrow screens, where the question this measures — which
// column ends in blank space — does not arise.
const VIEWPORT = { width: 1440, height: 900 }

// The left grid item is `.col-start-1.span-cols-8` (there is no
// `.key-info__left` class in the markup) and the right one is
// `.key-info__right`. Both are items of the same grid row, so see readme.md:
// their own heights are useless and we measure these inner elements instead.
const LEFT_CONTENT_SELECTOR = ".key-info__content"
const RIGHT_CONTENT_SELECTOR = ".key-data-block"

function parseArgs(argv) {
    const args = {
        base: "https://ourworldindata.org",
        out: "devTools/datapageColumnHeights/columnHeights.jsonl",
        summary: undefined,
        concurrency: 8,
        limit: Infinity,
    }
    for (let i = 0; i < argv.length; i += 2) {
        const key = argv[i]?.replace(/^--/, "")
        const value = argv[i + 1]
        if (!(key in args)) throw new Error(`unknown option: ${argv[i]}`)
        args[key] =
            key === "concurrency" || key === "limit" ? Number(value) : value
    }
    args.summary ??= args.out.replace(/\.jsonl$/, "") + ".summary.json"
    return args
}

const args = parseArgs(process.argv.slice(2))

// Outbound HTTPS in sandboxed environments goes through an egress proxy that
// resets Chromium's own TLS handshake, so requests are made with Playwright's
// Node-side request API and fulfilled into the page. Same approach as
// devTools/screenshot/screenshotPage.mjs.
const api = await request.newContext({
    proxy: process.env.HTTPS_PROXY
        ? { server: process.env.HTTPS_PROXY }
        : undefined,
    ignoreHTTPSErrors: true,
})

/** Every /grapher/ URL listed in the site's sitemap, following sitemap indexes. */
async function fetchGrapherUrls(base) {
    const seen = new Set()
    const queue = [`${base}/sitemap.xml`]
    const urls = []
    while (queue.length) {
        const sitemapUrl = queue.shift()
        if (seen.has(sitemapUrl)) continue
        seen.add(sitemapUrl)
        const resp = await api.get(sitemapUrl)
        if (!resp.ok()) {
            console.warn(`[warn] ${sitemapUrl} -> HTTP ${resp.status()}`)
            continue
        }
        const xml = await resp.text()
        const isIndex = /<sitemapindex/.test(xml)
        for (const [, loc] of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
            const url = loc.trim()
            if (isIndex) queue.push(url)
            else if (url.includes("/grapher/")) urls.push(url)
        }
    }
    return urls
}

// Runs in the page. Returns null when the page does not render the two-column
// "What you should know about this indicator" section — single-column ("About
// this data") and metadata-box layouts have no left column to compare against.
function measureInPage([leftSelector, rightSelector]) {
    const left = document.querySelector(leftSelector)
    const right = document.querySelector(rightSelector)
    if (!left || !right) return null

    // Top-level bullets only: a nested <li> belongs to its parent bullet, which
    // is the same rule countDescriptionKeyBullets() applies to the markdown.
    const description = document.querySelector(".key-info__key-description")
    const nBullets = description
        ? [...description.querySelectorAll("li")].filter(
              (li) => !li.parentElement?.closest("li")
          ).length
        : 0

    const round = (n) => Math.round(n * 10) / 10
    return {
        leftPx: round(left.getBoundingClientRect().height),
        rightPx: round(right.getBoundingClientRect().height),
        nBullets,
    }
}

async function measurePage(context, url) {
    const slug = url.split("/grapher/")[1]?.split(/[?#]/)[0]
    const page = await context.newPage()
    try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 90000 })
        // Expandable toggles start collapsed; the collapsed state is what the
        // reader sees first and so what the comparison is about.
        const measured = await page.evaluate(measureInPage, [
            LEFT_CONTENT_SELECTOR,
            RIGHT_CONTENT_SELECTOR,
        ])
        return measured && { slug, ...measured }
    } catch (error) {
        console.warn(`[warn] ${url}: ${error.message}`)
        return null
    } finally {
        await page.close()
    }
}

function summarize(rows) {
    const gaps = rows
        .map((row) => row.leftPx - row.rightPx)
        .sort((a, b) => a - b)
    const quantile = (p) =>
        gaps[Math.min(gaps.length - 1, Math.floor(p * gaps.length))]
    const inBand = (predicate) => {
        const band = rows.filter((row) => predicate(row.nBullets))
        const leftTaller = band.filter((row) => row.leftPx > row.rightPx).length
        return { pages: band.length, leftTaller }
    }
    return {
        runDate: new Date().toISOString().slice(0, 10),
        viewport: VIEWPORT,
        pages: rows.length,
        leftTaller: rows.filter((row) => row.leftPx > row.rightPx).length,
        rightTaller: rows.filter((row) => row.leftPx < row.rightPx).length,
        ties: rows.filter((row) => row.leftPx === row.rightPx).length,
        gapPx: {
            p5: quantile(0.05),
            p25: quantile(0.25),
            median: quantile(0.5),
            p75: quantile(0.75),
            p95: quantile(0.95),
        },
        byBulletCount: {
            0: inBand((n) => n === 0),
            "1-2": inBand((n) => n >= 1 && n <= 2),
            "3-5": inBand((n) => n >= 3 && n <= 5),
            "6-9": inBand((n) => n >= 6 && n <= 9),
            "10+": inBand((n) => n >= 10),
        },
    }
}

const urls = (await fetchGrapherUrls(args.base)).slice(0, args.limit)
console.log(`${urls.length} /grapher/ URLs from the sitemap`)

// The cloud sandbox pins a Chromium at /opt/pw-browsers that may not match the
// revision our @playwright/test version expects, so prefer it when it exists.
const SANDBOX_CHROMIUM = "/opt/pw-browsers/chromium"
const browser = await chromium.launch({
    executablePath:
        process.env.CHROMIUM_PATH ??
        (existsSync(SANDBOX_CHROMIUM) ? SANDBOX_CHROMIUM : undefined),
    args: ["--no-sandbox"],
})
const context = await browser.newContext({ viewport: VIEWPORT })
await context.route(
    (u) => !["localhost", "127.0.0.1"].includes(u.hostname),
    async (route) => {
        const req = route.request()
        try {
            const resp = await api.fetch(req.url(), {
                method: req.method(),
                headers: await req.allHeaders(),
                data: req.postDataBuffer() ?? undefined,
                maxRedirects: 5,
            })
            await route.fulfill({
                status: resp.status(),
                headers: resp.headers(),
                body: await resp.body(),
            })
        } catch {
            await route.abort()
        }
    }
)

await mkdir(path.dirname(args.out), { recursive: true })
const outFile = await open(args.out, "w")
const rows = []
let done = 0
let next = 0

await Promise.all(
    Array.from({ length: args.concurrency }, async () => {
        while (next < urls.length) {
            const url = urls[next++]
            const row = await measurePage(context, url)
            if (row) {
                rows.push(row)
                await outFile.write(JSON.stringify(row) + "\n")
            }
            if (++done % 100 === 0)
                console.log(
                    `${done}/${urls.length} rendered, ${rows.length} two-column`
                )
        }
    })
)

await outFile.close()
const summary = summarize(rows)
await writeFile(args.summary, JSON.stringify(summary, null, 4) + "\n")
console.log(summary)
console.log(`wrote ${rows.length} rows to ${args.out} and ${args.summary}`)

await context.close()
await browser.close()
await api.dispose()
