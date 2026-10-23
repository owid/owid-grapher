/**
 * The Scatter tab holds the settings only scatter plots have: the timeline
 * and connected lines, the target year of the x-axis indicator, the point
 * labels and filtering by color group.
 */
import type { Locator } from "@playwright/test"
import {
    DimensionProperty,
    ScatterPointLabelStrategy,
} from "@ourworldindata/types"
import { expect, test, type ChartEditorPage } from "./harness.js"
import { indicators } from "./fixture.js"
import { lineChart, scatterPlot } from "./charts.js"

const scatter = scatterPlot({
    x: indicators.gdpPerCapita,
    y: indicators.lifeExpectancy,
})

const yDimension = {
    property: DimensionProperty.y,
    variableId: indicators.lifeExpectancy.id,
}
const xDimension = {
    property: DimensionProperty.x,
    variableId: indicators.gdpPerCapita.id,
}

/** The point label dropdown, which has no label of its own */
const pointLabelSelect = (editor: ChartEditorPage): Locator =>
    editor.section("Point Labels").locator("select")

const tab = (editor: ChartEditorPage, name: string): Locator =>
    editor.tabs.filter({ hasText: new RegExp(`^${name}$`) })

test("the Scatter tab only shows for scatter plots", async ({
    seedChart,
    openEditor,
}) => {
    const lineEditor = await openEditor(
        await seedChart(lineChart(indicators.lifeExpectancy))
    )
    await expect(tab(lineEditor, "Data")).toHaveCount(1)
    await expect(tab(lineEditor, "Scatter")).toHaveCount(0)

    const scatterEditor = await openEditor(await seedChart(scatter))
    await expect(tab(scatterEditor, "Scatter")).toHaveCount(1)
})

test.describe("toggles", () => {
    const rows = [
        {
            name: "hiding the timeline writes hideTimeline",
            label: "Hide timeline",
            field: "hideTimeline",
        },
        {
            name: "hiding connected lines writes hideConnectedScatterLines",
            label: "Hide connected scatter lines",
            field: "hideConnectedScatterLines",
        },
        {
            name: "hiding point labels writes hideScatterLabels",
            label: "Hide point labels (except when hovering)",
            field: "hideScatterLabels",
        },
        {
            name: "excluding entities without a color group writes matchingEntitiesOnly",
            label: "Exclude entities that do not belong in any color group",
            field: "matchingEntitiesOnly",
        },
    ]
    for (const row of rows) {
        test(row.name, async ({ seedChart, openEditor }) => {
            const editor = await openEditor(await seedChart(scatter))
            await editor.openTab("Scatter")
            const toggle = editor.checkbox(row.label)
            await expect(toggle).not.toBeChecked()

            await toggle.check()

            expect(await editor.saveChanges()).toEqual({ [row.field]: true })
        })

        test(`unticking: ${row.name.replace(" writes ", " removes ")}`, async ({
            seedChart,
            openEditor,
        }) => {
            const editor = await openEditor(
                await seedChart({ ...scatter, [row.field]: true })
            )
            await editor.openTab("Scatter")
            const toggle = editor.checkbox(row.label)
            await expect(toggle).toBeChecked()

            await toggle.uncheck()

            expect(await editor.saveChanges()).toEqual({
                [row.field]: undefined,
            })
        })
    }
})

// The target year is stored on the x dimension, so the whole dimensions
// array is the change
test.describe("Override X axis target year", () => {
    test("entering a year sets the x dimension's targetYear", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(await seedChart(scatter))
        await editor.openTab("Scatter")
        const field = editor.field("Override X axis target year")
        await expect(field).toHaveValue("")

        await editor.fill(field, "2010")

        // the field is debounced; the axis label shows when it is applied
        await expect(editor.preview).toContainText("GDP per capita in 2010")
        expect(await editor.saveChanges()).toEqual({
            dimensions: [yDimension, { ...xDimension, targetYear: 2010 }],
        })
    })

    test("clearing the year removes the x dimension's targetYear", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...scatter,
                dimensions: [yDimension, { ...xDimension, targetYear: 2010 }],
            })
        )
        await editor.openTab("Scatter")
        const field = editor.field("Override X axis target year")
        await expect(field).toHaveValue("2010")
        await expect(editor.preview).toContainText("GDP per capita in 2010")

        await editor.fill(field, "")

        await expect(editor.preview).not.toContainText("GDP per capita in 2010")
        expect(await editor.saveChanges()).toEqual({
            dimensions: [yDimension, xDimension],
        })
    })
})

test.describe("Point Labels", () => {
    test("choosing a point label strategy writes scatterPointLabelStrategy", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(await seedChart(scatter))
        await editor.openTab("Scatter")
        const select = pointLabelSelect(editor)
        await expect(select.locator("option")).toHaveText(["year", "x", "y"])
        await expect(select).toHaveValue("year")

        await select.selectOption("x")

        expect(await editor.saveChanges()).toEqual({
            scatterPointLabelStrategy: "x",
        })
    })

    test("choosing the default 'year' drops a seeded point label strategy", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...scatter,
                scatterPointLabelStrategy: ScatterPointLabelStrategy.y,
            })
        )
        await editor.openTab("Scatter")
        const select = pointLabelSelect(editor)
        await expect(select).toHaveValue("y")

        await select.selectOption("year")

        expect(await editor.saveChanges()).toEqual({
            scatterPointLabelStrategy: undefined,
        })
    })
})
