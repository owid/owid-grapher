/**
 * The Data tab decides which entities a chart shows and how users can change
 * them: the selection mode, the entity type names, the default selection (with
 * its colors, order and peer shortcuts), the highlighted series, the entity
 * include/exclude lists, the missing-data strategy and the peer strategy.
 *
 * Every test changes one control and checks the exact config change on save;
 * where a control also keeps other settings consistent (e.g. deselecting an
 * entity drops its focus), that knock-on change is part of the contract.
 */
import type { Locator, Page } from "@playwright/test"
import {
    EntitySelectionMode,
    MissingDataStrategy,
    PeerCountryStrategy,
    type CatalogKey,
} from "@ourworldindata/types"
import { expect, test, type ChartEditorPage } from "./harness.js"
import { entities, indicators } from "./fixture.js"
import { lineChart, scatterPlot } from "./charts.js"

const { france, germany, japan, kenya, nigeria, world } = entities

/** The dropdown that adds an entity to the selection */
const addEntitySelect = (editor: ChartEditorPage): Locator =>
    editor.section("Data to show").locator("select").first()

/** The rows of the selected entities, in selection order */
const selectedEntityRows = (editor: ChartEditorPage): Locator =>
    editor.section("Data to show").locator(".SortableList .EditableListItem")

const selectedEntityRow = (editor: ChartEditorPage, name: string): Locator =>
    selectedEntityRows(editor).filter({ hasText: name })

/** The × that removes an entity from the selection or focus */
const removeIcon = (row: Locator): Locator => row.locator(".clickable")

/** The dropdown that adds a series to the highlighted ones */
const addFocusSelect = (editor: ChartEditorPage): Locator =>
    editor.section("Data to highlight").locator("select").first()

const focusedSeriesRows = (editor: ChartEditorPage): Locator =>
    editor.section("Data to highlight").locator(".ListItem")

const includedEntityRows = (editor: ChartEditorPage): Locator =>
    editor.form.locator(".includedEntities li")

const excludedEntityRows = (editor: ChartEditorPage): Locator =>
    editor.form.locator(".excludedEntities li")

const includeField = (editor: ChartEditorPage): Locator =>
    editor.field("Explicit start selection (leave empty to show all entities)")

const excludeField = (editor: ChartEditorPage): Locator =>
    editor.field("Exclude individual entities")

const missingDataField = (editor: ChartEditorPage): Locator =>
    editor.field(
        "Missing data strategy (for when one or more variables are missing for an entity)"
    )

const catalogPaths: Record<CatalogKey, string> = {
    gdp: "gdp/gdp.json",
    population: "population/population.json",
    neighbors: "neighbours/neighbours.json",
}

/**
 * Serves a catalog file the peer buttons load. The test stack serves no
 * catalog, so tests that need one provide exactly the data they rely on.
 * Must be called before the editor opens, since catalog loads are memoized.
 */
async function serveCatalog(
    page: Page,
    key: CatalogKey,
    data: unknown[]
): Promise<void> {
    await page.route(
        `**/catalog/external/owid_grapher/latest/${catalogPaths[key]}`,
        (route) => route.fulfill({ json: data })
    )
}

test.describe("Can user add/change data?", () => {
    const rows = [
        {
            name: "choosing 'User can change entity' writes change-country",
            option: "User can change entity",
            expected: "change-country",
        },
        {
            name: "choosing 'User cannot change/add data' writes disabled",
            option: "User cannot change/add data",
            expected: "disabled",
        },
    ]
    for (const row of rows) {
        test(row.name, async ({ seedChart, openEditor }) => {
            const editor = await openEditor(
                await seedChart(lineChart(indicators.lifeExpectancy))
            )
            await editor.openTab("Data")
            await expect(
                editor.radio("User can add and remove data")
            ).toBeChecked()

            await editor.radio(row.option).check()

            expect(await editor.saveChanges()).toEqual({
                addCountryMode: row.expected,
            })
        })
    }

    test("choosing 'User can add and remove data' drops the default mode from the config", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                addCountryMode: EntitySelectionMode.Disabled,
            })
        )
        await editor.openTab("Data")
        await expect(editor.radio("User cannot change/add data")).toBeChecked()

        await editor.radio("User can add and remove data").check()

        expect(await editor.saveChanges()).toEqual({
            addCountryMode: undefined,
        })
    })
})

test.describe("Entity type", () => {
    const rows = [
        {
            name: "editing the singular entity name writes entityType",
            label: "Entity name (singular)",
            initial: "country or region",
            value: "state",
            field: "entityType",
        },
        {
            name: "editing the plural entity name writes entityTypePlural",
            label: "Entity name (plural)",
            initial: "countries and regions",
            value: "states",
            field: "entityTypePlural",
        },
    ]
    for (const row of rows) {
        test(row.name, async ({ seedChart, openEditor }) => {
            const editor = await openEditor(
                await seedChart(lineChart(indicators.lifeExpectancy))
            )
            await editor.openTab("Data")
            const field = editor.field(row.label)
            await expect(field).toHaveValue(row.initial)

            await editor.fill(field, `  ${row.value}  `)

            expect(await editor.saveChanges()).toEqual({
                [row.field]: row.value,
            })
        })
    }
})

test.describe("Data to show", () => {
    test("the list shows the seeded selection in order", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                selectedEntityNames: [kenya.name, france.name, japan.name],
            })
        )
        await editor.openTab("Data")

        await expect(selectedEntityRows(editor)).toHaveText([
            kenya.name,
            france.name,
            japan.name,
        ])
    })

    test("adding an entity appends it to the selection", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                selectedEntityNames: [france.name, kenya.name],
            })
        )
        await editor.openTab("Data")

        await addEntitySelect(editor).selectOption(germany.name)

        await expect(selectedEntityRows(editor)).toHaveText([
            france.name,
            kenya.name,
            germany.name,
        ])
        expect(await editor.saveChanges()).toEqual({
            selectedEntityNames: [france.name, kenya.name, germany.name],
        })
    })

    test("the add dropdown only offers entities that aren't selected yet", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                selectedEntityNames: [france.name, kenya.name],
            })
        )
        await editor.openTab("Data")

        await expect(addEntitySelect(editor).locator("option")).toHaveText([
            "Select data",
            "Brazil",
            "Germany",
            "India",
            "Japan",
            "Nigeria",
            "World",
        ])
    })

    test("removing an entity deselects it", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                selectedEntityNames: [france.name, kenya.name],
            })
        )
        await editor.openTab("Data")

        await removeIcon(selectedEntityRow(editor, france.name)).click()

        await expect(selectedEntityRows(editor)).toHaveText([kenya.name])
        expect(await editor.saveChanges()).toEqual({
            selectedEntityNames: [kenya.name],
        })
    })

    test("removing an entity also drops it from the highlighted series", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                selectedEntityNames: [france.name, kenya.name, japan.name],
                focusedSeriesNames: [kenya.name],
            })
        )
        await editor.openTab("Data")

        await removeIcon(selectedEntityRow(editor, kenya.name)).click()

        await expect(focusedSeriesRows(editor)).toHaveCount(0)
        expect(await editor.saveChanges()).toEqual({
            selectedEntityNames: [france.name, japan.name],
            focusedSeriesNames: undefined,
        })
    })

    test("adding an entity keeps the highlighted series", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                selectedEntityNames: [france.name, kenya.name],
                focusedSeriesNames: [france.name],
            })
        )
        await editor.openTab("Data")

        await addEntitySelect(editor).selectOption(japan.name)

        await expect(focusedSeriesRows(editor)).toHaveText([france.name])
        expect(await editor.saveChanges()).toEqual({
            selectedEntityNames: [france.name, kenya.name, japan.name],
        })
    })

    test("removing an entity keeps the other highlighted series", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                selectedEntityNames: [france.name, kenya.name, japan.name],
                focusedSeriesNames: [kenya.name, france.name],
            })
        )
        await editor.openTab("Data")

        await removeIcon(selectedEntityRow(editor, kenya.name)).click()

        await expect(focusedSeriesRows(editor)).toHaveText([france.name])
        expect(await editor.saveChanges()).toEqual({
            selectedEntityNames: [france.name, japan.name],
            focusedSeriesNames: [france.name],
        })
    })

    test("dragging an entity reorders the selection", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                selectedEntityNames: [france.name, kenya.name, japan.name],
            })
        )
        await editor.openTab("Data")

        // Keyboard dragging: pick up Japan, move it up one place, drop it
        const handle = selectedEntityRow(editor, japan.name).locator(
            ".SortableList__handle"
        )
        // dnd-kit announces each step to screen readers; waiting for the
        // announcements keeps the key presses from outrunning the drag
        const announcement = editor.page.getByRole("status")
        await handle.focus()
        await editor.page.keyboard.press("Space")
        await expect(announcement).toHaveText(
            "Draggable item Japan was moved over droppable area Japan."
        )
        await editor.page.keyboard.press("ArrowUp")
        await expect(announcement).toHaveText(
            "Draggable item Japan was moved over droppable area Kenya."
        )
        await editor.page.keyboard.press("Space")

        await expect(selectedEntityRows(editor)).toHaveText([
            france.name,
            japan.name,
            kenya.name,
        ])
        expect(await editor.saveChanges()).toEqual({
            selectedEntityNames: [france.name, japan.name, kenya.name],
        })
    })

    test("picking a color for an entity writes selectedEntityColors", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                selectedEntityNames: [france.name, kenya.name],
            })
        )
        await editor.openTab("Data")

        await selectedEntityRow(editor, france.name)
            .locator(".ColorBox")
            .click()
        await editor.page
            .locator(".colorpicker-tooltip")
            .getByRole("button", { name: /\(#883039\)$/i })
            .first()
            .click()

        expect(await editor.saveChanges()).toEqual({
            "selectedEntityColors.France": "#883039",
        })
    })

    test("resetting an entity's color removes it from selectedEntityColors", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                selectedEntityNames: [france.name, kenya.name],
                selectedEntityColors: { [france.name]: "#883039" },
            })
        )
        await editor.openTab("Data")

        await selectedEntityRow(editor, france.name)
            .locator(".ColorBox")
            .click()
        await editor
            .button(
                "Reset to color scheme default",
                editor.page.locator(".colorpicker-tooltip")
            )
            .click()

        expect(await editor.saveChanges()).toEqual({
            "selectedEntityColors.France": undefined,
        })
    })

    test("'Clear' empties the selection", async ({ seedChart, openEditor }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                selectedEntityNames: [france.name, kenya.name],
            })
        )
        await editor.openTab("Data")

        await editor.button("Clear", editor.section("Data to show")).click()

        await expect(selectedEntityRows(editor)).toHaveCount(0)
        await expect(
            editor.button("Clear", editor.section("Data to show"))
        ).toHaveCount(0)
        expect(await editor.saveChanges()).toEqual({
            selectedEntityNames: undefined,
        })
    })

    test("'Reset to live' only shows once the selection changed, and restores the saved selection", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                selectedEntityNames: [france.name, kenya.name],
            })
        )
        await editor.openTab("Data")
        const resetToLive = editor.button("Reset to live")
        await expect(resetToLive).toHaveCount(0)

        await removeIcon(selectedEntityRow(editor, france.name)).click()
        await addEntitySelect(editor).selectOption(japan.name)
        await expect(selectedEntityRows(editor)).toHaveText([
            kenya.name,
            japan.name,
        ])
        await resetToLive.click()

        await expect(selectedEntityRows(editor)).toHaveText([
            france.name,
            kenya.name,
        ])
        await expect(resetToLive).toHaveCount(0)
        expect(await editor.saveChanges()).toEqual({})
    })
})

test.describe("Data to show: adding peers", () => {
    test("'+ Parent regions' adds World for the first selected country", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                selectedEntityNames: [france.name, kenya.name],
            })
        )
        await editor.openTab("Data")
        const section = editor.section("Data to show")
        await expect(section.locator(".add-peers-country-select")).toHaveValue(
            france.name
        )

        await editor.button("+ Parent regions", section).click()

        await expect(selectedEntityRows(editor)).toHaveText([
            france.name,
            kenya.name,
            world.name,
        ])
        expect(await editor.saveChanges()).toEqual({
            selectedEntityNames: [france.name, kenya.name, world.name],
        })
    })

    test("'+ Similar by GDP' adds countries within 1.25x of the target's GDP per capita, same continent first", async ({
        page,
        seedChart,
        openEditor,
    }) => {
        await serveCatalog(page, "gdp", [
            { entity: france.name, year: 2020, value: 40_000 },
            { entity: germany.name, year: 2020, value: 45_000 },
            { entity: japan.name, year: 2020, value: 41_000 },
            { entity: nigeria.name, year: 2020, value: 5_000 },
        ])
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                selectedEntityNames: [france.name, kenya.name],
            })
        )
        await editor.openTab("Data")

        await editor
            .button("+ Similar by GDP", editor.section("Data to show"))
            .click()

        await expect(selectedEntityRows(editor)).toHaveText([
            france.name,
            kenya.name,
            germany.name,
            japan.name,
        ])
        expect(await editor.saveChanges()).toEqual({
            selectedEntityNames: [
                france.name,
                kenya.name,
                germany.name,
                japan.name,
            ],
        })
    })

    test("'+ Similar by population' adds countries within 1.5x of the target's population", async ({
        page,
        seedChart,
        openEditor,
    }) => {
        await serveCatalog(page, "population", [
            { entity: france.name, year: 2020, value: 68_000_000 },
            { entity: germany.name, year: 2020, value: 84_000_000 },
            { entity: japan.name, year: 2020, value: 125_000_000 },
        ])
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                selectedEntityNames: [france.name, kenya.name],
            })
        )
        await editor.openTab("Data")

        await editor
            .button("+ Similar by population", editor.section("Data to show"))
            .click()

        await expect(selectedEntityRows(editor)).toHaveText([
            france.name,
            kenya.name,
            germany.name,
        ])
        expect(await editor.saveChanges()).toEqual({
            selectedEntityNames: [france.name, kenya.name, germany.name],
        })
    })

    test("'+ Neighbors' adds the available neighbors of the chosen target country", async ({
        page,
        seedChart,
        openEditor,
    }) => {
        await serveCatalog(page, "neighbors", [
            { entity: france.name, value: ["Belgium", germany.name, "Spain"] },
            { entity: kenya.name, value: ["Ethiopia", "Somalia"] },
        ])
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                selectedEntityNames: [kenya.name, france.name],
            })
        )
        await editor.openTab("Data")
        const section = editor.section("Data to show")
        const target = section.locator(".add-peers-country-select")
        await expect(target).toHaveValue(kenya.name)

        await target.selectOption(france.name)
        await editor.button("+ Neighbors", section).click()

        await expect(selectedEntityRows(editor)).toHaveText([
            kenya.name,
            france.name,
            germany.name,
        ])
        expect(await editor.saveChanges()).toEqual({
            selectedEntityNames: [kenya.name, france.name, germany.name],
        })
    })
})

test.describe("Data to highlight", () => {
    test("adding a series writes focusedSeriesNames", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                selectedEntityNames: [france.name, kenya.name],
            })
        )
        await editor.openTab("Data")
        await expect(addFocusSelect(editor).locator("option")).toHaveText([
            "Select data",
            france.name,
            kenya.name,
        ])

        await addFocusSelect(editor).selectOption(kenya.name)

        await expect(focusedSeriesRows(editor)).toHaveText([kenya.name])
        expect(await editor.saveChanges()).toEqual({
            focusedSeriesNames: [kenya.name],
        })
    })

    test("removing a highlighted series drops it from focusedSeriesNames", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                selectedEntityNames: [france.name, kenya.name, japan.name],
                focusedSeriesNames: [france.name, japan.name],
            })
        )
        await editor.openTab("Data")
        await expect(focusedSeriesRows(editor)).toHaveText([
            france.name,
            japan.name,
        ])

        await removeIcon(
            focusedSeriesRows(editor).filter({ hasText: france.name })
        ).click()

        expect(await editor.saveChanges()).toEqual({
            focusedSeriesNames: [japan.name],
        })
    })

    test("focusing a series that isn't plotted is an error that blocks saving until it is removed", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                selectedEntityNames: [france.name, kenya.name],
                focusedSeriesNames: [germany.name],
            })
        )
        await editor.openTab("Data")
        const invalidRow = focusedSeriesRows(editor)
        const saveButton = editor.button("Save draft")

        await expect(invalidRow).toHaveText(`${germany.name} (not plotted)`)
        await expect(
            editor.settings.locator(".SaveButtons .alert-danger")
        ).toHaveText(
            "Invalid focus state. The following entities/indicators are not plotted: Germany"
        )
        await expect(saveButton).toBeDisabled()

        await removeIcon(invalidRow).click()

        await expect(
            editor.settings.locator(".SaveButtons .alert-danger")
        ).toHaveCount(0)
        await expect(saveButton).toBeEnabled()
        expect(await editor.saveChanges()).toEqual({
            focusedSeriesNames: undefined,
        })
    })

    test("scatter plots can't highlight series", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(
                scatterPlot({
                    x: indicators.gdpPerCapita,
                    y: indicators.lifeExpectancy,
                })
            )
        )
        await editor.openTab("Data")

        await expect(editor.section("Data to show")).toBeVisible()
        await expect(editor.section("Data to highlight")).toHaveCount(0)
    })
})

test.describe("Inherited selection and focus", () => {
    test("an overridden selection can be reset to the inherited one", async ({
        seedChart,
        openEditor,
    }) => {
        // renewablesShare's ETL config selects France and Germany
        const editor = await openEditor(
            await seedChart(
                {
                    ...lineChart(indicators.renewablesShare),
                    selectedEntityNames: undefined,
                },
                { inheritance: true }
            )
        )
        await editor.openTab("Data")
        const section = editor.section("Data to show")
        const resetButton = section.getByTitle("Reset to parent selection")
        await expect(selectedEntityRows(editor)).toHaveText([
            france.name,
            germany.name,
        ])
        await expect(section).toContainText(
            "The entity selection is currently inherited from the parent indicator."
        )
        await expect(resetButton).toBeDisabled()

        await addEntitySelect(editor).selectOption(kenya.name)

        await expect(section).not.toContainText("currently inherited")
        await editor.save()
        expect(await editor.storedChanges()).toEqual({
            selectedEntityNames: [france.name, germany.name, kenya.name],
        })

        await resetButton.click()

        await expect(selectedEntityRows(editor)).toHaveText([
            france.name,
            germany.name,
        ])
        await editor.save()
        expect(await editor.storedChanges()).toEqual({})
    })

    test("an overridden focus can be reset to the inherited one", async ({
        seedChart,
        openEditor,
    }) => {
        // electricityAccess's ETL config focuses France
        const editor = await openEditor(
            await seedChart(lineChart(indicators.electricityAccess), {
                inheritance: true,
            })
        )
        await editor.openTab("Data")
        const resetButton = editor
            .section("Data to highlight")
            .getByTitle("Reset to parent focus")
        await expect(focusedSeriesRows(editor)).toHaveText([france.name])
        await expect(resetButton).toBeDisabled()

        await removeIcon(
            focusedSeriesRows(editor).filter({ hasText: france.name })
        ).click()

        await expect(focusedSeriesRows(editor)).toHaveCount(0)
        await expect(resetButton).toBeEnabled()

        await resetButton.click()

        await expect(focusedSeriesRows(editor)).toHaveText([france.name])
        await editor.save()
        expect(await editor.storedChanges()).toEqual({})
    })
})

test.describe("Manual entity selection", () => {
    test("adding an entity to the start selection includes it and deselects entities outside it", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                selectedEntityNames: [france.name, kenya.name],
            })
        )
        await editor.openTab("Data")
        await expect(includedEntityRows(editor)).toHaveCount(0)

        await includeField(editor).selectOption(france.name)

        await expect(includedEntityRows(editor)).toHaveText([france.name])
        await expect(selectedEntityRows(editor)).toHaveText([france.name])
        expect(await editor.saveChanges()).toEqual({
            includedEntityNames: [france.name],
            selectedEntityNames: [france.name],
        })
    })

    test("removing an entity from the start selection un-includes it", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                selectedEntityNames: [france.name],
                includedEntityNames: [france.name, germany.name],
            })
        )
        await editor.openTab("Data")
        await expect(includedEntityRows(editor)).toHaveText([
            france.name,
            germany.name,
        ])

        await removeIcon(
            includedEntityRows(editor).filter({ hasText: germany.name })
        ).click()

        expect(await editor.saveChanges()).toEqual({
            includedEntityNames: [france.name],
        })
    })

    test("'Clear start selection' empties the included entities", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                selectedEntityNames: [france.name],
                includedEntityNames: [france.name, germany.name],
            })
        )
        await editor.openTab("Data")

        await editor.button("Clear start selection").click()

        await expect(includedEntityRows(editor)).toHaveCount(0)
        expect(await editor.saveChanges()).toEqual({
            includedEntityNames: undefined,
        })
    })

    test("excluding an entity adds it to the excluded entities", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(
                scatterPlot({
                    x: indicators.gdpPerCapita,
                    y: indicators.lifeExpectancy,
                })
            )
        )
        await editor.openTab("Data")
        await expect(excludedEntityRows(editor)).toHaveCount(0)

        await excludeField(editor).selectOption(france.name)

        await expect(excludedEntityRows(editor)).toHaveText([france.name])
        expect(await editor.saveChanges()).toEqual({
            excludedEntityNames: [france.name],
        })
    })

    test("excluding a selected entity also deselects it", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                selectedEntityNames: [france.name, kenya.name],
            })
        )
        await editor.openTab("Data")

        await excludeField(editor).selectOption(kenya.name)

        await expect(selectedEntityRows(editor)).toHaveText([france.name])
        expect(await editor.saveChanges()).toEqual({
            excludedEntityNames: [kenya.name],
            selectedEntityNames: [france.name],
        })
    })

    test("with a start selection, only included entities can be excluded", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                selectedEntityNames: [france.name],
                includedEntityNames: [france.name, germany.name],
            })
        )
        await editor.openTab("Data")

        await expect(
            excludeField(editor).locator("option:not([hidden])")
        ).toHaveText([france.name, germany.name])
    })

    test("removing an entity from the exclude list un-excludes it", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                excludedEntityNames: [germany.name, japan.name],
            })
        )
        await editor.openTab("Data")
        await expect(excludedEntityRows(editor)).toHaveText([
            germany.name,
            japan.name,
        ])

        await removeIcon(
            excludedEntityRows(editor).filter({ hasText: germany.name })
        ).click()

        expect(await editor.saveChanges()).toEqual({
            excludedEntityNames: [japan.name],
        })
    })

    test("'Clear exclude list' empties the excluded entities", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                excludedEntityNames: [germany.name, japan.name],
            })
        )
        await editor.openTab("Data")

        await editor.button("Clear exclude list").click()

        await expect(excludedEntityRows(editor)).toHaveCount(0)
        expect(await editor.saveChanges()).toEqual({
            excludedEntityNames: undefined,
        })
    })
})

test.describe("Missing data", () => {
    test("choosing a missing data strategy writes missingDataStrategy", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(
                lineChart(indicators.coalEmissions, indicators.gasEmissions)
            )
        )
        await editor.openTab("Data")
        const field = missingDataField(editor)
        await expect(field).toHaveValue("auto")

        await field.selectOption({ label: "Hide entities with missing data" })

        expect(await editor.saveChanges()).toEqual({
            missingDataStrategy: "hide",
        })
    })

    test("choosing 'Automatic' drops a seeded missing data strategy", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.coalEmissions, indicators.gasEmissions),
                missingDataStrategy: MissingDataStrategy.show,
            })
        )
        await editor.openTab("Data")
        const field = missingDataField(editor)
        await expect(field).toHaveValue("show")

        await field.selectOption({ label: "Automatic" })

        expect(await editor.saveChanges()).toEqual({
            missingDataStrategy: undefined,
        })
    })

    test("the missing data strategy only shows for charts with several indicators", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(lineChart(indicators.coalEmissions))
        )
        await editor.openTab("Data")

        await expect(editor.section("Peer countries")).toBeVisible()
        await expect(editor.section("Missing data")).toHaveCount(0)
    })
})

test.describe("Peer countries", () => {
    test("choosing a peer country strategy writes peerCountryStrategy", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(lineChart(indicators.lifeExpectancy))
        )
        await editor.openTab("Data")
        const field = editor.field("Peer country strategy")
        await expect(field).toHaveValue("")

        await field.selectOption({ label: "Neighboring countries" })

        expect(await editor.saveChanges()).toEqual({
            peerCountryStrategy: "neighbors",
        })
    })

    test("choosing 'Unset' removes peerCountryStrategy", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                peerCountryStrategy: PeerCountryStrategy.GdpPerCapita,
            })
        )
        await editor.openTab("Data")
        const field = editor.field("Peer country strategy")
        await expect(field).toHaveValue("gdpPerCapita")

        await field.selectOption({ label: "Unset" })

        expect(await editor.saveChanges()).toEqual({
            peerCountryStrategy: undefined,
        })
    })
})
