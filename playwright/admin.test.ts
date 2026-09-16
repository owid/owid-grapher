import { expect, test } from "@playwright/test"

const ADMIN_BASE_URL = "http://localhost:8765/admin"

test("creates a chart draft in the admin", async ({ page }) => {
    const title = "Playwright admin chart"

    await page.goto(`${ADMIN_BASE_URL}/charts/create`)
    await page
        .locator(".chart-editor-settings")
        .getByText("Text", { exact: true })
        .click()

    const headerSection = page
        .locator(".EditorTextTab section")
        .filter({ has: page.getByRole("heading", { name: "Header" }) })
    await headerSection.getByRole("textbox").first().fill(title)
    await page.getByRole("button", { name: "Create draft" }).click()

    await expect(page).toHaveURL(/\/admin\/charts\/(\d+)\/edit$/)

    const chartId = new URL(page.url()).pathname.match(
        /\/admin\/charts\/(\d+)\/edit/
    )?.[1]
    expect(chartId).toBeDefined()

    const response = await page
        .context()
        .request.get(`${ADMIN_BASE_URL}/api/charts/${chartId}.config.json`)
    expect(response.ok()).toBe(true)
    const config = await response.json()
    expect(config).toMatchObject({
        id: Number(chartId),
        isPublished: false,
        title,
    })
})
