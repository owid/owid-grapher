// Take a full-page screenshot of a (dev server) page, waiting for
// client-side content to finish loading.
//
// Usage: node devTools/screenshot/screenshotPage.mjs [url] [outfile]
//
// Written for sandboxed remote environments (e.g. Claude Code on the web)
// where outbound HTTPS must go through an egress proxy: Chromium's TLS
// handshake gets reset by the proxy, so external requests are routed
// through Playwright's Node-side request API instead, while localhost
// requests connect directly.
import { existsSync } from "node:fs"
import { chromium, request } from "@playwright/test"

// the cloud sandbox pins a Chromium at /opt/pw-browsers that may not match the
// revision our @playwright/test version expects, so prefer it when it exists;
// elsewhere let Playwright resolve its own browser
const SANDBOX_CHROMIUM = "/opt/pw-browsers/chromium"
const chromiumPath =
    process.env.CHROMIUM_PATH ??
    (existsSync(SANDBOX_CHROMIUM) ? SANDBOX_CHROMIUM : undefined)

const url =
    process.argv[2] ?? "http://localhost:3030/search?q=malaria&resultType=all"
const out = process.argv[3] ?? "screenshot.png"

const api = await request.newContext({
    proxy: process.env.HTTPS_PROXY
        ? { server: process.env.HTTPS_PROXY }
        : undefined,
    ignoreHTTPSErrors: true,
})
const browser = await chromium.launch({
    executablePath: chromiumPath,
    args: ["--no-sandbox"],
})
const context = await browser.newContext({
    viewport: { width: 1440, height: 1200 },
})
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
const page = await context.newPage()
page.on("pageerror", (err) => console.log("[pageerror]", err.message))

await page.goto(url, { waitUntil: "networkidle", timeout: 90000 })

const reject = page.getByText("Reject optional cookies")
if (await reject.isVisible().catch(() => false)) {
    await reject.click()
    await page.waitForTimeout(500)
}

await page
    .waitForFunction(
        () => document.querySelectorAll('[class*="skeleton" i]').length === 0,
        { timeout: 45000 }
    )
    .catch(() => console.log("[warn] skeletons still present after 45s"))

// scroll through the page to trigger lazy-loaded content, then back to top
await page.evaluate(async () => {
    const step = 800
    for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y)
        await new Promise((r) => setTimeout(r, 300))
    }
    window.scrollTo(0, 0)
})
await page.waitForLoadState("networkidle").catch(() => undefined)
await page
    .waitForFunction(
        () => document.querySelectorAll('[class*="skeleton" i]').length === 0,
        { timeout: 45000 }
    )
    .catch(() => console.log("[warn] skeletons still present after scroll"))

await page.waitForLoadState("networkidle").catch(() => undefined)
await page.waitForTimeout(3000)
await page.screenshot({ path: out, fullPage: true })
console.log("saved", out)
await browser.close()
await api.dispose()
