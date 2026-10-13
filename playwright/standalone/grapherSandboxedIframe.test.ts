import { lineChart } from "./charts.js"
import { entities, indicators } from "./fixture.js"
import { expect, test } from "./harness.js"

// Embedders may allow scripts without allowing same-origin access.
// Exercise startup and tab changes under real sandbox restrictions,
// where cookie and storage access are blocked.
// This happens when we're embedded with <iframe sandbox="allow-scripts">, which we should handle gracefully.
// In this case, features like cookies and localStorage are not usable.
test("Grapher renders and switches tabs in an allow-scripts sandbox", async ({
    page,
    baseURL,
    seedChart,
}) => {
    const slug = `sandboxed-chart-${crypto.randomUUID()}`
    await seedChart({
        ...lineChart(indicators.lifeExpectancy),
        slug,
        isPublished: true,
    })
    const countries = [entities.france, entities.germany]

    const chartUrl = new URL(`/grapher/${slug}`, baseURL)
    chartUrl.search = `?tab=chart&time=2000..2020&country=${countries.map((country) => country.code).join("~")}`
    await page.setContent(`
        <iframe title="Life expectancy" sandbox="allow-scripts"
            src="${chartUrl.href}" width="850" height="600"></iframe>
    `)
    const frame = page.frameLocator("iframe")

    // Check that accessing cookies, localStorage, sessionStorage really is forbidden by the sandbox environment
    expect(
        await frame.locator("body").evaluate(() => {
            const access: Record<string, string> = {}
            for (const key of [
                "cookie",
                "localStorage",
                "sessionStorage",
            ] as const) {
                try {
                    if (key === "cookie") void document.cookie
                    else void window[key]
                    access[key] = "accessible"
                } catch (error) {
                    access[key] =
                        error instanceof DOMException
                            ? error.name
                            : String(error)
                }
            }
            return access
        })
    ).toEqual({
        cookie: "SecurityError",
        localStorage: "SecurityError",
        sessionStorage: "SecurityError",
    })

    const chartTab = frame.getByRole("tab", { name: "Line", exact: true })
    const tableTab = frame.getByRole("tab", { name: "Table", exact: true })
    const lines = frame.locator(".Lines")
    const table = frame.getByRole("table")

    await expect(chartTab).toHaveAttribute("aria-selected", "true", {
        timeout: 25_000,
    })
    await expect(lines).toBeVisible()
    await expect(lines.locator("path").first()).toHaveAttribute("d", /.+/)
    await expect(table).toBeHidden()

    await tableTab.click()
    await expect(tableTab).toHaveAttribute("aria-selected", "true")
    await expect(table).toBeVisible()
    await expect(lines).toBeHidden()
    for (const country of countries) {
        const row = table.getByRole("row").filter({
            has: frame.getByRole("cell", { name: country.name, exact: true }),
        })
        await expect(row).toBeVisible()
        await expect(
            row.getByRole("cell").filter({ hasText: /\d/ }).first()
        ).toBeVisible()
    }

    await chartTab.click()
    await expect(chartTab).toHaveAttribute("aria-selected", "true")
    await expect(lines).toBeVisible()
    await expect(lines.locator("path").first()).toHaveAttribute("d", /.+/)
    await expect(table).toBeHidden()

    // Uncaught errors in the page fail the test through the `page` fixture
})
