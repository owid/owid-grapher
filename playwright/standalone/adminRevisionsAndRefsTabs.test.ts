/**
 * The Revisions tab lists the chart's saves and can restore one or discard
 * unsaved changes; the Refs tab lists where the chart is used and manages the
 * URLs that redirect to it.
 */
import type { APIRequestContext } from "@playwright/test"
import { DimensionProperty, type GrapherInterface } from "@ourworldindata/types"
import { latestGrapherConfigSchema } from "@ourworldindata/grapher"
import { expect, test } from "./harness.js"
import { indicators } from "./fixture.js"
import { lineChart } from "./charts.js"

async function saveChartRevision(
    request: APIRequestContext,
    chartId: number,
    config: GrapherInterface
): Promise<void> {
    const response = await request.put(
        `/admin/api/charts/${chartId}?inheritance=enable`,
        { data: { $schema: latestGrapherConfigSchema, ...config } }
    )
    const json = await response.json()
    expect(
        json,
        `updating a chart: ${JSON.stringify(json.error)}`
    ).toMatchObject({ success: true })
}

test.describe("Revisions tab", () => {
    test("each save adds a revision that can be compared to the previous one", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(lineChart(indicators.lifeExpectancy))
        )
        const form = await editor.openTab("Revisions")
        const saves = form.locator(".ant-timeline-item")
        // creating the chart stored its first revision
        await expect(saves).toHaveCount(1)
        await expect(editor.button("View", saves.first())).toBeVisible()
        await expect(editor.button("Restore", form)).toHaveCount(0)

        await editor.openTab("Text")
        await editor.fill(editor.field("Subtitle"), "A revised subtitle")
        await editor.save()
        await editor.openTab("Revisions")

        await expect(saves).toHaveCount(2)
        await expect(saves.first()).toContainText("Admin")
        await expect(saves.first()).toContainText("subtitle")
        await expect(editor.button("Restore", saves.first())).toHaveCount(0)
        await editor.button("Compare", saves.first()).click()
        const diff = editor.page.getByRole("dialog")
        await expect(diff).toContainText('"subtitle": "A revised subtitle"')
    })

    test("restoring an earlier save loads it into the editor for the next save", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(lineChart(indicators.lifeExpectancy))
        )
        await editor.openTab("Text")
        const savedSubtitle = await editor.field("Subtitle").inputValue()
        await editor.fill(editor.field("Subtitle"), "A revised subtitle")
        await editor.save()

        const form = await editor.openTab("Revisions")
        const saves = form.locator(".ant-timeline-item")
        await editor.button("Restore", saves.last()).click()
        await editor
            .button("Restore this version", editor.page.getByRole("dialog"))
            .click()

        await expect(saves.first()).toContainText("Unsaved changes")
        await editor.openTab("Text")
        await expect(editor.field("Subtitle")).toHaveValue(savedSubtitle)
        expect(await editor.saveChanges()).toEqual({})
    })

    test("discarding unsaved changes returns the editor to the last save", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(lineChart(indicators.lifeExpectancy))
        )
        await editor.openTab("Text")
        const savedSubtitle = await editor.field("Subtitle").inputValue()
        await editor.fill(editor.field("Subtitle"), "An unsaved subtitle")

        const form = await editor.openTab("Revisions")
        const unsaved = form
            .locator(".ant-timeline-item")
            .filter({ hasText: "Unsaved changes" })
        await editor.button("Compare", unsaved).click()
        await editor
            .button("Discard unsaved changes", editor.page.getByRole("dialog"))
            .click()

        await expect(unsaved).toHaveCount(0)
        await editor.openTab("Text")
        await expect(editor.field("Subtitle")).toHaveValue(savedSubtitle)
    })

    test("restoring a save that used another indicator applies that indicator's config", async ({
        seedChart,
        openEditor,
        request,
    }) => {
        const inherited = indicators.childMortality.grapherConfigETL
        const chart = await seedChart(lineChart(indicators.childMortality), {
            inheritance: true,
        })
        await saveChartRevision(
            request,
            chart.id,
            lineChart(indicators.lifeExpectancy)
        )
        const editor = await openEditor(chart)
        await expect(editor.preview).not.toContainText(inherited.subtitle)

        const form = await editor.openTab("Revisions")
        const saves = form.locator(".ant-timeline-item")
        await editor.button("Restore", saves.last()).click()
        await editor
            .button("Restore this version", editor.page.getByRole("dialog"))
            .click()

        await expect(editor.preview).toContainText(inherited.subtitle)
        expect(await editor.saveChanges()).toEqual({
            dimensions: [
                {
                    property: DimensionProperty.y,
                    variableId: indicators.childMortality.id,
                },
            ],
        })
    })
})

test.describe("Refs tab", () => {
    test("adding a redirect stores it and lists it", async ({
        seedChart,
        openEditor,
        request,
    }) => {
        const chart = await seedChart(lineChart(indicators.lifeExpectancy))
        const editor = await openEditor(chart)
        const form = await editor.openTab("Refs")
        const slugInput = form.getByPlaceholder("URL")
        await expect(editor.button("Add redirect", form)).toBeDisabled()

        await slugInput.fill(`old-slug-of-${chart.id}`)
        await form.getByPlaceholder("e.g. 'tab=map'").fill("tab=map")
        await editor.button("Add redirect", form).click()

        const listed = form.locator(".list-group-item")
        await expect(listed).toHaveCount(1)
        await expect(listed).toContainText(`old-slug-of-${chart.id}`)
        await expect(listed).toContainText("?tab=map")
        await expect(slugInput).toHaveValue("")
        const stored = await (
            await request.get(`/admin/api/charts/${chart.id}.redirects.json`)
        ).json()
        expect(stored.redirects).toMatchObject([
            { slug: `old-slug-of-${chart.id}`, targetQueryParam: "tab=map" },
        ])
    })

    test("a narrative chart derived from the chart is listed as a reference", async ({
        seedChart,
        openEditor,
        request,
    }) => {
        const chart = await seedChart(lineChart(indicators.lifeExpectancy))
        const name = `derived-from-${chart.id}`
        const response = await request.post("/admin/api/narrative-charts", {
            data: {
                type: "chart",
                name,
                parentChartId: chart.id,
                config: { title: "A narrative about life expectancy" },
            },
        })
        const { narrativeChartId } = await response.json()
        expect(narrativeChartId).toEqual(expect.any(Number))
        const editor = await openEditor(chart)

        await expect(editor.tabs.filter({ hasText: /^Refs/ })).toHaveText(
            "Refs (1)"
        )
        const form = await editor.openTab("Refs")
        await expect(
            form.getByRole("link", {
                name: "A narrative about life expectancy",
            })
        ).toHaveAttribute(
            "href",
            `/admin/narrative-charts/${narrativeChartId}/edit`
        )
    })

    test("a chart with references can't be deleted", async ({
        seedChart,
        openEditor,
        request,
    }) => {
        const chart = await seedChart(lineChart(indicators.lifeExpectancy))
        await request.post("/admin/api/narrative-charts", {
            data: {
                type: "chart",
                name: `keeps-alive-${chart.id}`,
                parentChartId: chart.id,
                config: {},
            },
        })
        const editor = await openEditor(chart)
        await expect(editor.tabs.filter({ hasText: /^Refs/ })).toHaveText(
            "Refs (1)"
        )

        const alert = editor.acceptNextDialog()
        await editor.button("Delete").click()

        expect(await alert).toContain("Cannot delete chart")
        const stored = await request.get(
            `/admin/api/charts/${chart.id}.config.json`
        )
        expect(stored.ok()).toBe(true)
    })
})
