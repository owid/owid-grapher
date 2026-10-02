/**
 * The Marimekko tab holds the settings only Marimekko charts have: the target
 * year of the x-axis (width) indicator and filtering by color group.
 */
import type { Locator } from "@playwright/test"
import { DimensionProperty } from "@ourworldindata/types"
import { expect, test, type ChartEditorPage } from "./harness.js"
import { indicators } from "./fixture.js"
import { lineChart, marimekkoChart } from "./charts.js"

const marimekko = marimekkoChart({
    x: indicators.population,
    y: indicators.gdpPerCapita,
})

const yDimension = {
    property: DimensionProperty.y,
    variableId: indicators.gdpPerCapita.id,
}
const xDimension = {
    property: DimensionProperty.x,
    variableId: indicators.population.id,
}

const tab = (editor: ChartEditorPage, name: string): Locator =>
    editor.tabs.filter({ hasText: new RegExp(`^${name}$`) })

const matchingEntitiesOnlyLabel =
    "Exclude entities that do not belong in any color group"

test("the Marimekko tab only shows for Marimekko charts", async ({
    seedChart,
    openEditor,
}) => {
    const lineEditor = await openEditor(
        await seedChart(lineChart(indicators.lifeExpectancy))
    )
    await expect(tab(lineEditor, "Data")).toHaveCount(1)
    await expect(tab(lineEditor, "Marimekko")).toHaveCount(0)

    const marimekkoEditor = await openEditor(await seedChart(marimekko))
    await expect(tab(marimekkoEditor, "Marimekko")).toHaveCount(1)
})

// The target year is stored on the x dimension, so the whole dimensions
// array is the change. The field is debounced and gives no sign when the
// value is applied, so these tests retry the save until it has landed.
test.describe("Override X axis target year", () => {
    test("entering a year sets the x dimension's targetYear", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(await seedChart(marimekko))
        await editor.openTab("Marimekko")
        const field = editor.field("Override X axis target year")
        await expect(field).toHaveValue("")

        await editor.fill(field, "2010")

        await expect(async () => {
            expect(await editor.saveChanges()).toEqual({
                dimensions: [yDimension, { ...xDimension, targetYear: 2010 }],
            })
        }).toPass()
    })

    test("clearing the year removes the x dimension's targetYear", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...marimekko,
                dimensions: [yDimension, { ...xDimension, targetYear: 2010 }],
            })
        )
        await editor.openTab("Marimekko")
        const field = editor.field("Override X axis target year")
        await expect(field).toHaveValue("2010")
        await expect(editor.preview).toContainText("Population in 2010")

        await editor.fill(field, "")

        await expect(async () => {
            expect(await editor.saveChanges()).toEqual({
                dimensions: [yDimension, xDimension],
            })
        }).toPass()
    })

    test("entering a year updates the preview's x-axis", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(await seedChart(marimekko))
        await editor.openTab("Marimekko")

        await editor.fill(editor.field("Override X axis target year"), "2010")

        await expect(editor.preview).toContainText("Population in 2010")
    })
})

test.describe("Exclude entities that do not belong in any color group", () => {
    test("ticking it writes matchingEntitiesOnly", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(await seedChart(marimekko))
        await editor.openTab("Marimekko")
        const toggle = editor.checkbox(matchingEntitiesOnlyLabel)
        await expect(toggle).not.toBeChecked()

        await toggle.check()

        expect(await editor.saveChanges()).toEqual({
            matchingEntitiesOnly: true,
        })
    })

    test("unticking it removes matchingEntitiesOnly", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({ ...marimekko, matchingEntitiesOnly: true })
        )
        await editor.openTab("Marimekko")
        const toggle = editor.checkbox(matchingEntitiesOnlyLabel)
        await expect(toggle).toBeChecked()

        await toggle.uncheck()

        expect(await editor.saveChanges()).toEqual({
            matchingEntitiesOnly: undefined,
        })
    })
})
