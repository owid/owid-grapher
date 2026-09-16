import { expect, Page, test } from "@playwright/test"

const WIKIPEDIA_ARCHIVE_BASE_URL = "http://localhost:8765"

const openWikipediaArchive = async (
    page: Page,
    chartSlug: string
): Promise<string[]> => {
    const requests: string[] = []
    page.on("request", (request) => requests.push(request.url()))
    await page.goto(
        `${WIKIPEDIA_ARCHIVE_BASE_URL}/latest/grapher/${chartSlug}.html`
    )
    return requests
}

test.describe("Wikipedia archive", () => {
    test("does not make Google Tag Manager requests", async ({ page }) => {
        const requests = await openWikipediaArchive(page, "life-expectancy")

        await page.waitForTimeout(3_000)
        expect(
            requests.filter((url) => url.includes("googletagmanager.com"))
        ).toEqual([])
    })

    test("rewrites detect-country requests to ourworldindata.org", async ({
        page,
    }) => {
        const requests = await openWikipediaArchive(page, "life-expectancy")

        await expect
            .poll(() =>
                requests.some((url) => url.includes("/api/detect-country"))
            )
            .toBe(true)

        // Keep observing after the expected request arrives so a later request
        // to the legacy service cannot slip past the negative assertion.
        await page.waitForTimeout(3_000)
        expect(
            requests.filter((url) => url.includes("detect-country.owid.io"))
        ).toEqual([])
    })
})
