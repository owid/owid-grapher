// Measure the rendered height of the two columns of the "What you should know
// about this indicator" section across every data page on the site.
//
// Usage:
//   npx tsx --tsconfig tsconfig.tsx.json \
//       devTools/datapageColumnHeights/measureColumnHeights.mjs [options]
//
//   --base <url>        site to sweep (default https://ourworldindata.org)
//   --out <path>        JSONL output, one line per page
//                       (default devTools/datapageColumnHeights/columnHeights.jsonl)
//   --summary <path>    summary statistics JSON
//                       (default alongside --out, with a .summary.json suffix)
//   --concurrency <n>   pages rendered in parallel (default 8)
//   --limit <n>         stop after n /grapher/ URLs (for a smoke run)
//
// It is run through tsx because it counts bullets with the same function the
// site does, which is TypeScript.
//
// See readme.md for what the numbers mean and why the two columns have to be
// measured by their content rather than by their grid items.
import { existsSync } from "node:fs"
import { mkdir, open, writeFile } from "node:fs/promises"
import path from "node:path"
import { chromium, request } from "@playwright/test"
import { normalizeDescriptionKey } from "@ourworldindata/types"
import { countDescriptionKeyBullets } from "../../site/datapageUtils.js"

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

// Bullet counts above this are lumped into one bucket in the summary; a handful
// of pages have runaway counts and no threshold would ever be set up there.
const MAX_REPORTED_BULLETS = 12

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

    // The props the page was rendered from, so bullets can be counted from the
    // same markdown the site counts rather than from the rendered list. Plain
    // data pages carry the datapage data directly; multi-dim pages carry the
    // view that was server-rendered.
    const descriptionKey =
        window._OWID_DATAPAGEV2_PROPS?.datapageData?.descriptionKey ??
        window._OWID_MULTI_DIM_PROPS?.initialViewData?.descriptionKey ??
        null

    const round = (n) => Math.round(n * 10) / 10
    return {
        leftPx: round(left.getBoundingClientRect().height),
        rightPx: round(right.getBoundingClientRect().height),
        descriptionKey,
    }
}

// Exactly the count the placement decision in site/AboutThisData.tsx makes, so
// the sweep and the site can never drift apart: nested bullets belong to their
// parent, a descriptionKey written as prose has none. Persisted metadata may
// still hold the pre-migration array form, which normalizeDescriptionKey folds
// into markdown the same way every other ingress point does.
function countBullets(descriptionKey) {
    const markdown = normalizeDescriptionKey(descriptionKey)
    return markdown ? countDescriptionKeyBullets(markdown) : 0
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
        if (!measured) return null
        const { descriptionKey, ...heights } = measured
        return { slug, ...heights, nBullets: countBullets(descriptionKey) }
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
        // Per count and cumulative, which is what a threshold is read off.
        perBulletCount: Object.fromEntries(
            Array.from({ length: MAX_REPORTED_BULLETS + 1 }, (_, n) => [
                n === MAX_REPORTED_BULLETS ? `${n}+` : `${n}`,
                {
                    ...inBand(
                        n === MAX_REPORTED_BULLETS
                            ? (count) => count >= n
                            : (count) => count === n
                    ),
                    atLeast: inBand((count) => count >= n),
                },
            ])
        ),
        // How each candidate threshold would place the card, scored against
        // the column that actually turned out taller. See readme.md.
        thresholds: Object.fromEntries(
            Array.from({ length: MAX_REPORTED_BULLETS - 1 }, (_, i) => {
                const threshold = i + 2
                const misplaced = rows.filter((row) =>
                    row.nBullets < threshold
                        ? row.leftPx > row.rightPx
                        : row.leftPx <= row.rightPx
                )
                return [
                    threshold,
                    {
                        misplaced: misplaced.length,
                        accuracy:
                            (rows.length - misplaced.length) / rows.length,
                        wastedPx: Math.round(
                            misplaced.reduce(
                                (total, row) =>
                                    total + Math.abs(row.leftPx - row.rightPx),
                                0
                            )
                        ),
                    },
                ]
            })
        ),
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
