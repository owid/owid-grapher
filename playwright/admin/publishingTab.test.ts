/**
 * The Publishing tab holds what a chart has because it is a row in the admin
 * database: its URL, whether it inherits its indicator's config, its tags and
 * the data page override.
 *
 * Toggling inheritance must not fold the indicator's values into the chart's
 * own patch: when inheritance is switched off, values that were inherited stop
 * applying instead of becoming explicit overrides, and when it is switched
 * on, the indicator's values start applying without being copied. Tags are
 * the exception to the save-based contract: they are stored immediately
 * through their own endpoint, so those tests read them back from the API.
 */
import type { APIRequestContext, Locator } from "@playwright/test"
import type { DbChartTagJoin } from "@ourworldindata/types"
import { expect, test, type ChartEditorPage } from "./harness.js"
import { indicators, tags } from "./fixture.js"
import { lineChart } from "./charts.js"

/** The link/unlink button of an auto text field, which resets an override */
const resetButton = (editor: ChartEditorPage, label: string): Locator =>
    editor.field(label).locator("xpath=..").getByRole("button")

// the ETL config of the childMortality indicator
const inherited = indicators.childMortality.grapherConfigETL

const INHERITANCE_TOGGLE = "Inherit settings from the indicator"

async function storedInheritance(
    request: APIRequestContext,
    chartId: number
): Promise<boolean> {
    const parent = await (
        await request.get(`/admin/api/charts/${chartId}.parent.json`)
    ).json()
    return Boolean(parent.isInheritanceEnabled)
}

test.describe("URL", () => {
    test("editing the slug writes it slugified", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(lineChart(indicators.lifeExpectancy))
        )
        await editor.openTab("Publishing")

        await editor.fill(editor.field("/grapher/"), "Life Expectancy Chart")

        await expect(editor.field("/grapher/")).toHaveValue(
            "life-expectancy-chart"
        )
        expect(await editor.saveChanges()).toEqual({
            slug: "life-expectancy-chart",
        })
    })

    test("resetting the slug derives it from the title", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                slug: "a-custom-slug",
            })
        )
        await editor.openTab("Publishing")
        await expect(editor.field("/grapher/")).toHaveValue("a-custom-slug")

        await resetButton(editor, "/grapher/").click()

        await expect(editor.field("/grapher/")).toHaveValue("test-chart")
        await expect(resetButton(editor, "/grapher/")).toBeDisabled()
        expect(await editor.saveChanges()).toEqual({ slug: "test-chart" })
    })
})

test.describe("Copy as Markdown", () => {
    test("copying the admin URL copies a Markdown link to the editor", async ({
        seedChart,
        openEditor,
        page,
        context,
    }) => {
        await context.grantPermissions(["clipboard-read", "clipboard-write"])
        const chart = await seedChart(lineChart(indicators.lifeExpectancy))
        const editor = await openEditor(chart)
        const form = await editor.openTab("Publishing")
        await expect(editor.button("Copy Grapher URL", form)).toHaveCount(0)

        await editor.button("Copy admin URL", form).click()

        await expect
            .poll(() => page.evaluate(() => navigator.clipboard.readText()))
            .toMatch(
                new RegExp(
                    `^\\[Test chart\\]\\(https?://[^)]+/admin/charts/${chart.id}/edit\\)$`
                )
            )
    })

    test("copying the grapher URL of a published chart copies a Markdown link to it", async ({
        seedChart,
        openEditor,
        page,
        context,
    }) => {
        await context.grantPermissions(["clipboard-read", "clipboard-write"])
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                slug: "published-life-expectancy",
                isPublished: true,
            })
        )
        const form = await editor.openTab("Publishing")

        await editor.button("Copy Grapher URL", form).click()

        await expect
            .poll(() => page.evaluate(() => navigator.clipboard.readText()))
            .toMatch(
                /^\[Test chart\]\(https?:\/\/[^)]+\/grapher\/published-life-expectancy\)$/
            )
    })
})

test.describe("Inheritance", () => {
    test("an inheriting chart of an indicator without a config has nothing to inherit", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(lineChart(indicators.lifeExpectancy), {
                inheritance: true,
            })
        )
        const form = await editor.openTab("Publishing")

        await expect(editor.section("Inheritance", form)).toContainText(
            "has no config of its own yet"
        )
        const debugForm = await editor.openTab("Debug")
        await expect(editor.section("Base config", debugForm)).toHaveCount(0)
    })

    test("enabling inheritance applies the indicator's config without copying it", async ({
        seedChart,
        openEditor,
        request,
    }) => {
        const chart = await seedChart(lineChart(indicators.childMortality), {
            inheritance: false,
        })
        const editor = await openEditor(chart)
        await expect(editor.preview).not.toContainText(inherited.subtitle)
        await editor.openTab("Publishing")
        const toggle = editor.checkbox(INHERITANCE_TOGGLE)
        await expect(toggle).not.toBeChecked()

        await toggle.check()

        await expect(editor.preview).toContainText(inherited.subtitle)
        const debugForm = await editor.openTab("Debug")
        await expect(editor.section("Base config", debugForm)).toBeVisible()
        expect(await editor.saveChanges()).toEqual({})
        expect(await storedInheritance(request, chart.id)).toBe(true)
    })

    test("disabling inheritance stops applying the indicator's config without copying it", async ({
        seedChart,
        openEditor,
        request,
    }) => {
        const chart = await seedChart(lineChart(indicators.childMortality), {
            inheritance: true,
        })
        const editor = await openEditor(chart)
        await expect(editor.preview).toContainText(inherited.subtitle)
        await expect(editor.preview).toContainText(inherited.note)
        await editor.openTab("Publishing")
        const toggle = editor.checkbox(INHERITANCE_TOGGLE)
        await expect(toggle).toBeChecked()

        await toggle.uncheck()

        await expect(editor.preview).not.toContainText(inherited.subtitle)
        await expect(editor.preview).not.toContainText(inherited.note)
        expect(await editor.saveChanges()).toEqual({})
        expect(await storedInheritance(request, chart.id)).toBe(false)
    })
})

test.describe("Tags", () => {
    const health = tags[0]
    const energy = tags[1]

    async function chartTags(
        request: APIRequestContext,
        chartId: number
    ): Promise<unknown> {
        const response = await request.get(
            `/admin/api/charts/${chartId}.tags.json`
        )
        return (await response.json()).tags
    }

    async function seedTags(
        request: APIRequestContext,
        chartId: number,
        chartTags: DbChartTagJoin[]
    ): Promise<void> {
        const response = await request.post(
            `/admin/api/charts/${chartId}/setTags`,
            { data: { tags: chartTags } }
        )
        expect(await response.json()).toMatchObject({ success: true })
    }

    function waitForTagSave(editor: ChartEditorPage): Promise<unknown> {
        return editor.page
            .waitForResponse(
                (response) =>
                    response.request().method() === "POST" &&
                    response.url().endsWith(`/charts/${editor.chartId}/setTags`)
            )
            .then((response) => response.json())
    }

    test("adding a tag saves it right away, without saving the chart", async ({
        seedChart,
        openEditor,
        request,
    }) => {
        const chart = await seedChart(lineChart(indicators.lifeExpectancy))
        const editor = await openEditor(chart)
        await editor.openTab("Publishing")
        const chartSaves: string[] = []
        editor.page.on("request", (request) => {
            if (request.method() === "PUT") chartSaves.push(request.url())
        })
        const tagsSection = editor.section("Tags")

        await editor.button("Edit tags", tagsSection).click()
        await tagsSection.getByRole("combobox").fill("Heal")
        await editor.page.getByRole("option", { name: health.name }).click()
        const saved = waitForTagSave(editor)
        await editor.page.keyboard.press("Escape")

        expect(await saved).toMatchObject({ success: true })
        await expect(tagsSection.locator(".TagBadge")).toHaveText([health.name])
        expect(await chartTags(request, chart.id)).toEqual([
            {
                id: health.id,
                name: health.name,
                keyChartLevel: 0,
                isApproved: 1,
            },
        ])
        expect(chartSaves, "chart saves").toEqual([])
    })

    test("removing a tag saves the remaining ones right away", async ({
        seedChart,
        openEditor,
        request,
    }) => {
        const chart = await seedChart(lineChart(indicators.lifeExpectancy))
        await seedTags(request, chart.id, [
            { ...health, keyChartLevel: 0, isApproved: true },
            { ...energy, keyChartLevel: 0, isApproved: true },
        ])
        const editor = await openEditor(chart)
        await editor.openTab("Publishing")
        const tagsSection = editor.section("Tags")
        await expect(tagsSection.locator(".TagBadge")).toHaveText([
            energy.name,
            health.name,
        ])

        await editor.button("Edit tags", tagsSection).click()
        await tagsSection
            .locator(".EditTags")
            .getByRole("button", { name: energy.name })
            .click()
        const saved = waitForTagSave(editor)
        await editor.page.keyboard.press("Escape")

        expect(await saved).toMatchObject({ success: true })
        await expect(tagsSection.locator(".TagBadge")).toHaveText([health.name])
        expect(await chartTags(request, chart.id)).toEqual([
            {
                id: health.id,
                name: health.name,
                keyChartLevel: 0,
                isApproved: 1,
            },
        ])
    })

    test("clicking a tag's key chart icon cycles its key chart level, starting at the top", async ({
        seedChart,
        openEditor,
        request,
    }) => {
        const chart = await seedChart(lineChart(indicators.lifeExpectancy))
        await seedTags(request, chart.id, [
            { ...health, keyChartLevel: 0, isApproved: true },
        ])
        const editor = await openEditor(chart)
        await editor.openTab("Publishing")
        const sortingIcon = editor
            .section("Tags")
            .locator(".TagBadge", { hasText: health.name })
            .locator(".TagBadge__sorting")

        let saved = waitForTagSave(editor)
        await sortingIcon.click()
        expect(await saved).toMatchObject({ success: true })
        expect(await chartTags(request, chart.id)).toEqual([
            {
                id: health.id,
                name: health.name,
                keyChartLevel: 3,
                isApproved: 1,
            },
        ])

        saved = waitForTagSave(editor)
        await sortingIcon.click()
        expect(await saved).toMatchObject({ success: true })
        expect(await chartTags(request, chart.id)).toEqual([
            {
                id: health.id,
                name: health.name,
                keyChartLevel: 2,
                isApproved: 1,
            },
        ])
    })

    test("approving a suggested tag saves it as approved", async ({
        seedChart,
        openEditor,
        request,
    }) => {
        const chart = await seedChart(lineChart(indicators.lifeExpectancy))
        await seedTags(request, chart.id, [
            { ...health, keyChartLevel: 0, isApproved: false },
        ])
        const editor = await openEditor(chart)
        await editor.openTab("Publishing")
        const badge = editor
            .section("Tags")
            .locator(".TagBadge", { hasText: health.name })
        await expect(badge).toHaveClass(/TagBadge--is-pending/)

        const saved = waitForTagSave(editor)
        await badge.locator(".TagBadge__approve").click()

        expect(await saved).toMatchObject({ success: true })
        await expect(badge).not.toHaveClass(/TagBadge--is-pending/)
        expect(await chartTags(request, chart.id)).toEqual([
            {
                id: health.id,
                name: health.name,
                keyChartLevel: 0,
                isApproved: 1,
            },
        ])
    })
})

test.describe("Data page", () => {
    test("forcing a data page is saved with the chart", async ({
        seedChart,
        openEditor,
        page,
    }) => {
        const chart = await seedChart(lineChart(indicators.lifeExpectancy))
        const editor = await openEditor(chart)
        await editor.openTab("Publishing")
        const toggle = editor.checkbox("Force to be a data page")
        await expect(toggle).not.toBeChecked()

        await toggle.check()

        // The setting isn't part of the config but sent along with it
        const saveRequest = page.waitForRequest(
            (request) =>
                request.method() === "PUT" &&
                new URL(request.url()).pathname ===
                    `/admin/api/charts/${chart.id}`
        )
        expect(await editor.saveChanges()).toEqual({})
        expect(
            new URL((await saveRequest).url()).searchParams.get("forceDatapage")
        ).toBe("true")

        const reopened = await openEditor(chart)
        await reopened.openTab("Publishing")
        await expect(reopened.checkbox("Force to be a data page")).toBeChecked()
    })
})
