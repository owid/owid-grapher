import {
    DimensionProperty,
    type GrapherInterface,
    type OwidVariableDataMetadataDimensions,
} from "@ourworldindata/types"
import { expect, test, type Page, type Route } from "@playwright/test"

const config = (id = 101): GrapherInterface => ({
    $schema: "https://files.ourworldindata.org/schemas/grapher-schema.011.json",
    title: id === 101 ? "First metric" : "Second metric",
    slug: "fixture",
    dimensions: [{ property: DimensionProperty.y, variableId: id }],
    selectedEntityNames: ["France", "Germany"],
})
const data = (id: number): OwidVariableDataMetadataDimensions["data"] => ({
    years: [2000, 2010, 2000, 2010],
    entities: [1, 1, 2, 2],
    values: id === 101 ? [10, 20, 30, 40] : [100, 200, 300, 400],
})
const metadata = (
    id: number
): OwidVariableDataMetadataDimensions["metadata"] => ({
    id,
    name: id === 101 ? "First metric" : "Second metric",
    unit: "units",
    display: { numDecimalPlaces: 0 },
    source: { name: "Local fixture" },
    dimensions: {
        years: { values: [{ id: 2000 }, { id: 2010 }] },
        entities: {
            values: [
                { id: 1, name: "France", code: "FRA" },
                { id: 2, name: "Germany", code: "DEU" },
            ],
        },
    },
})
async function localData(page: Page): Promise<void> {
    await page.route("**/*", async (route) => {
        const url = new URL(route.request().url())
        const match = url.pathname.match(/(101|202)\.(data|metadata)\.json/)
        if (match)
            return route.fulfill({
                json:
                    match[2] === "data"
                        ? data(Number(match[1]))
                        : metadata(Number(match[1])),
            })
        if (url.pathname.endsWith(".config.json"))
            return route.fulfill({
                json: config(url.pathname.includes("second") ? 202 : 101),
            })
        if (url.hostname !== "127.0.0.1") return route.abort()
        return route.continue()
    })
}

test.beforeEach(async ({ page }) => {
    await localData(page)
})
test("standalone tab and share state survive reload", async ({ page }) => {
    await page.goto("/")
    await expect(
        page.getByText("France", { exact: true }).first()
    ).toBeVisible()
    await page
        .getByRole("button", {
            name: "Edit countries and regions",
            exact: true,
        })
        .click()
    await page.getByRole("checkbox", { name: "Germany", exact: true }).uncheck()
    await page.getByRole("button", { name: "Close", exact: true }).click()
    await page
        .getByRole("slider", { name: "Start time: 2000", exact: true })
        .press("End")
    await page.getByRole("tab", { name: "Table", exact: true }).click()
    await expect(page).toHaveURL(/time=latest/)
    expect(new URL(page.url()).searchParams.get("country")).toBe("~FRA")
    await expect(
        page.getByRole("tab", { name: "Table", exact: true })
    ).toHaveAttribute("aria-selected", "true")
    const shareUrl = page.url()
    await page.goto(shareUrl)
    await expect(
        page.getByRole("tab", { name: "Table", exact: true })
    ).toHaveAttribute("aria-selected", "true")
    await expect(
        page.getByRole("columnheader", { name: "2010", exact: true })
    ).toBeVisible()
    await page.getByRole("tab", { name: "Line", exact: true }).click()
    await page
        .getByRole("button", {
            name: "Edit countries and regions",
            exact: true,
        })
        .click()
    await expect(
        page.getByRole("checkbox", { name: "France", exact: true }).first()
    ).toBeChecked()
    await expect(
        page.getByRole("checkbox", { name: "Germany", exact: true })
    ).not.toBeChecked()
})

test("multiple embeds hydrate and keep independent tabs", async ({ page }) => {
    await page.goto("/?fixture=embeds")
    const first = page.locator("#chart-0")
    const second = page.locator("#chart-1")
    await first.getByRole("tab", { name: "Table", exact: true }).click()
    await expect(
        first.getByRole("tab", { name: "Table", exact: true })
    ).toHaveAttribute("aria-selected", "true")
    await expect(
        second.getByRole("tab", { name: "Line", exact: true })
    ).toHaveAttribute("aria-selected", "true")
})

// Keep the old data request pending until the user has selected and loaded another view.
test("the newest multidimensional view keeps matching data when an older request finishes last", async ({
    page,
}) => {
    let releaseOld!: () => Promise<void>
    const oldRequested = new Promise<void>((resolve) => {
        void page.route("**/101.data.json*", async (route: Route) => {
            releaseOld = async () => {
                await route.fulfill({ json: data(101) })
            }
            resolve()
        })
    })
    await page.goto("/?fixture=multi")
    await oldRequested
    await page.getByRole("button", { name: "Metric", exact: true }).click()
    await page
        .getByRole("option", { name: "Second metric", exact: true })
        .click()
    await expect(
        page.getByRole("heading", { name: /Second metric/ })
    ).toBeVisible()
    await page.getByRole("tab", { name: "Table", exact: true }).click()
    await expect(
        page.getByRole("row", { name: /France 100 200/ })
    ).toBeVisible()
    const oldResponse = page.waitForResponse((response) =>
        response.url().includes("101.data.json")
    )
    await releaseOld()
    await oldResponse
    await page.evaluate(
        () =>
            new Promise<void>((resolve) =>
                requestAnimationFrame(() =>
                    requestAnimationFrame(() => resolve())
                )
            )
    )
    await expect(
        page.getByRole("heading", { name: /Second metric/ })
    ).toBeVisible()
    await expect(
        page.getByRole("row", { name: /France 100 200/ })
    ).toBeVisible()
    await expect(
        page.getByRole("row", { name: /Germany 300 400/ })
    ).toBeVisible()
})

test.describe("touch map legend", () => {
    test.use({ hasTouch: true })
    test("pins the visible bin highlight after touch release and clears it on the next outside touch", async ({
        page,
    }) => {
        await page.goto("/?tab=map")
        const swatches = page.locator(".numericColorLegend #swatches rect")
        await expect(swatches).toHaveCount(7)
        await page
            .locator(".numericColorLegend #swatch-hit-areas rect")
            .nth(3)
            .tap()
        // A highlighted swatch is painted on top with its own stroke.
        await expect(swatches).toHaveCount(8)
        await page.mouse.move(0, 0)
        await expect(swatches).toHaveCount(8)
        await page.getByRole("heading", { name: /Fixture chart/ }).tap()
        await expect(swatches).toHaveCount(7)
    })
})
