import { expect, Page } from "@playwright/test"
import { createBdd } from "playwright-bdd"

const { Given, Then } = createBdd()

const ARCHIVE_BASE = "http://localhost:8764"
const WIKIPEDIA_ARCHIVE_BASE = "http://localhost:8765"

function trackGtmRequests(page: Page): string[] {
    const gtmRequests: string[] = []
    page.on("request", (req) => {
        if (req.url().includes("googletagmanager.com")) {
            gtmRequests.push(req.url())
        }
    })
    ;(page as any).__gtmRequests = gtmRequests
    return gtmRequests
}

Given(
    "I open {string} from the production archive",
    async ({ page }, chart: string) => {
        trackGtmRequests(page)
        await page.goto(`${ARCHIVE_BASE}/latest/grapher/${chart}.html`)
    }
)

Given(
    "I open {string} from the wikipedia archive",
    async ({ page }, chart: string) => {
        trackGtmRequests(page)
        await page.goto(
            `${WIKIPEDIA_ARCHIVE_BASE}/latest/grapher/${chart}.html`
        )
    }
)

Then(
    "the page should make requests to Google Tag Manager",
    async ({ page }) => {
        await page.waitForTimeout(3_000)
        const gtmRequests = (page as any).__gtmRequests as string[]
        expect(gtmRequests.length).toBeGreaterThan(0)
    }
)

Then(
    "the page should not make requests to Google Tag Manager",
    async ({ page }) => {
        await page.waitForTimeout(3_000)
        const gtmRequests = (page as any).__gtmRequests as string[]
        expect(gtmRequests).toEqual([])
    }
)
