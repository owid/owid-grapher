import { expect, Page } from "@playwright/test"
import { createBdd } from "playwright-bdd"

const { Given, Then } = createBdd()

const WIKIPEDIA_ARCHIVE_BASE = "http://localhost:8765"

function trackRequests(page: Page): string[] {
    const requests: string[] = []
    page.on("request", (req) => {
        requests.push(req.url())
    })
    ;(page as any).__trackedRequests = requests
    return requests
}

function getTrackedRequests(page: Page): string[] {
    return (page as any).__trackedRequests as string[]
}

Given(
    "I open {string} from the wikipedia archive",
    async ({ page }, chart: string) => {
        trackRequests(page)
        await page.goto(
            `${WIKIPEDIA_ARCHIVE_BASE}/latest/grapher/${chart}.html`
        )
    }
)

Then(
    "the page should make requests to {string}",
    async ({ page }, urlFragment: string) => {
        await page.waitForTimeout(3_000)
        const requests = getTrackedRequests(page)
        const matching = requests.filter((url) => url.includes(urlFragment))
        expect(matching.length).toBeGreaterThan(0)
    }
)

Then(
    "the page should not make requests to {string}",
    async ({ page }, urlFragment: string) => {
        await page.waitForTimeout(3_000)
        const requests = getTrackedRequests(page)
        const matching = requests.filter((url) => url.includes(urlFragment))
        expect(matching).toEqual([])
    }
)
