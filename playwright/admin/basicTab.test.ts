/**
 * The Basic tab decides what kind of chart it is and which indicators it
 * shows: the chart type tags and the map tab toggle, the indicator slots with
 * their dimension cards, and the chart's tags.
 *
 * Changing the chart types or the number of y indicators also re-applies
 * defaults (scatter axes, Marimekko stacking, the entity selection), so those
 * tests list every field the editor writes, not just the one clicked. Tags are
 * the exception to the save-based contract: they are stored immediately
 * through their own endpoint, so those tests read them back from the API.
 */
import type { APIRequestContext, Locator, Page } from "@playwright/test"
import {
    DimensionProperty,
    EntitySelectionMode,
    OwidVariableRoundingMode,
    type DbChartTagJoin,
    type OwidChartDimensionInterface,
    type OwidVariableDisplayConfigInterface,
} from "@ourworldindata/types"
import { expect, test, type ChartEditorPage, exactly } from "./harness.js"
import { entities, indicators, tags, type FixtureIndicator } from "./fixture.js"
import {
    lineChart,
    marimekkoChart,
    scatterPlot,
    stackedAreaChart,
    discreteBarChart,
} from "./charts.js"

/** A chart type (or the map) toggle in the Tabs section, e.g. "Line Chart" */
function chartTypeTag(editor: ChartEditorPage, label: string): Locator {
    return editor.checkbox(label, editor.section("Tabs"))
}

function indicatorSlot(editor: ChartEditorPage, slotName: string): Locator {
    return editor
        .section("Add indicators")
        .locator(".VariableSlots > div")
        .filter({
            has: editor.page.locator(".DimensionSlotHeader h5", {
                hasText: exactly(slotName),
            }),
        })
}

/** The names of the indicators in a slot, in order */
function slotIndicators(editor: ChartEditorPage, slotName: string): Locator {
    return indicatorSlot(editor, slotName).locator(".dimensionLink")
}

function dimensionCard(
    editor: ChartEditorPage,
    indicatorName: string
): Locator {
    return editor
        .section("Add indicators")
        .locator(".DimensionCard")
        .filter({
            has: editor.page.locator(".dimensionLink", {
                hasText: exactly(indicatorName),
            }),
        })
}

async function expandDimensionCard(
    editor: ChartEditorPage,
    indicatorName: string
): Promise<Locator> {
    const card = dimensionCard(editor, indicatorName)
    await card.locator('.clickable:has(svg[data-icon="chevron-down"])').click()
    await expect(editor.field("Display name", card)).toBeVisible()
    return card
}

function removeButton(card: Locator): Locator {
    return card.locator('.clickable:has(svg[data-icon="xmark"])')
}

function replaceButton(card: Locator): Locator {
    return card.locator('.clickable:has(svg[data-icon="right-left"])')
}

/** The link/unlink button next to an auto field, which resets it to auto */
function bindToDataButton(editor: ChartEditorPage, label: string): Locator {
    return editor.form
        .locator(".form-group")
        .filter({
            has: editor.page.locator(":scope > label", {
                hasText: exactly(label),
            }),
        })
        .locator(".input-group-append button")
}

/** Drags a dimension card by its handle onto another card of the slot */
async function dragDimensionCard(
    editor: ChartEditorPage,
    indicatorName: string,
    ontoIndicatorName: string
): Promise<void> {
    const handle = dimensionCard(editor, indicatorName).locator(
        ".SortableList__handle"
    )
    const target = dimensionCard(editor, ontoIndicatorName)
    // keep both cards clear of the sticky save buttons at the bottom
    await target.evaluate((element) =>
        element.scrollIntoView({ block: "center" })
    )
    const from = await handle.boundingBox()
    const to = await target.boundingBox()
    if (!from || !to) throw new Error("dimension cards aren't visible")
    const { mouse } = editor.page
    await mouse.move(from.x + from.width / 2, from.y + from.height / 2)
    await mouse.down()
    // dnd-kit needs intermediate moves to detect the drag and the drop target
    await mouse.move(from.x + from.width / 2, to.y + to.height * 0.75, {
        steps: 10,
    })
    await mouse.up()
}

class IndicatorSelector {
    readonly modal: Locator

    constructor(readonly page: Page) {
        this.modal = page.locator(".VariableSelector")
    }

    async search(text: string): Promise<void> {
        await this.modal.getByPlaceholder("Search...").fill(text)
    }

    /** An indicator in the search results */
    result(name: string): Locator {
        return this.modal
            .locator(".searchResults")
            .getByRole("checkbox", { name: new RegExp(`^${name} \\(`) })
    }

    /** The indicators chosen so far */
    get chosen(): Locator {
        return this.modal.locator(".selectedData li")
    }

    async removeNamespace(namespace: string): Promise<void> {
        await this.modal
            .locator(".ant-select-selection-item")
            .filter({ hasText: namespace })
            .locator(".ant-select-selection-item-remove")
            .click()
    }

    async confirm(): Promise<void> {
        await this.modal
            .getByRole("button", { name: /^Set variables?$/ })
            .click()
        await expect(this.modal).toHaveCount(0)
    }
}

async function openIndicatorSelector(
    editor: ChartEditorPage,
    slotName: string
): Promise<IndicatorSelector> {
    await indicatorSlot(editor, slotName)
        .locator(".dimensionSlot", { hasText: /^Add indicators?$/ })
        .click()
    const selector = new IndicatorSelector(editor.page)
    await expect(selector.modal).toBeVisible()
    return selector
}

const y = (
    indicator: FixtureIndicator,
    display?: OwidVariableDisplayConfigInterface
): OwidChartDimensionInterface => ({
    property: DimensionProperty.y,
    variableId: indicator.id,
    ...(display && { display }),
})
const x = (indicator: FixtureIndicator): OwidChartDimensionInterface => ({
    property: DimensionProperty.x,
    variableId: indicator.id,
})

test.describe("Tabs", () => {
    test("adding a chart type from the same group combines it with the current one", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(lineChart(indicators.lifeExpectancy))
        )
        await expect(chartTypeTag(editor, "Line chart")).toBeChecked()
        await expect(chartTypeTag(editor, "Slope chart")).not.toBeChecked()

        await chartTypeTag(editor, "Slope chart").click()

        await expect(chartTypeTag(editor, "Line chart")).toBeChecked()
        await expect(chartTypeTag(editor, "Slope chart")).toBeChecked()
        expect(await editor.saveChanges()).toEqual({
            chartTypes: ["LineChart", "SlopeChart"],
        })
    })

    test("adding a chart type from another group replaces the current ones", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.coalEmissions),
                chartTypes: ["LineChart", "DiscreteBar"],
            })
        )

        await chartTypeTag(editor, "Area chart").click()

        await expect(chartTypeTag(editor, "Area chart")).toBeChecked()
        await expect(chartTypeTag(editor, "Line chart")).not.toBeChecked()
        const singleIndicatorCharts = editor
            .section("Tabs")
            .locator(".chart-type-group")
            .filter({ hasText: "Single y-indicator charts" })
        await expect(
            editor.checkbox("Bar chart", singleIndicatorCharts)
        ).not.toBeChecked()
        expect(await editor.saveChanges()).toEqual({
            chartTypes: ["StackedArea"],
        })
    })

    test("removing a chart type keeps the others", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                chartTypes: ["LineChart", "DiscreteBar"],
            })
        )

        await chartTypeTag(editor, "Line chart").click()

        await expect(chartTypeTag(editor, "Line chart")).not.toBeChecked()
        expect(await editor.saveChanges()).toEqual({
            chartTypes: ["DiscreteBar"],
        })
    })

    test("removing the only chart type leaves a chart without chart tabs", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                hasMapTab: true,
            })
        )

        await chartTypeTag(editor, "Line chart").click()

        expect(await editor.saveChanges()).toEqual({ chartTypes: [] })
    })

    test("switching to a scatter plot adds GDP per capita on a log x-axis, continents as color and population as size", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(stackedAreaChart(indicators.lifeExpectancy))
        )

        await chartTypeTag(editor, "Scatter plot").click()

        await expect(slotIndicators(editor, "X axis")).toHaveText([
            indicators.gdpPerCapita.name,
        ])
        await expect(slotIndicators(editor, "Color")).toHaveText([
            indicators.continents.name,
        ])
        await expect(slotIndicators(editor, "Size")).toHaveText([
            indicators.population.name,
        ])
        expect(await editor.saveChanges()).toEqual({
            chartTypes: ["ScatterPlot"],
            dimensions: [
                y(indicators.lifeExpectancy),
                x(indicators.gdpPerCapita),
                { property: "color", variableId: indicators.continents.id },
                { property: "size", variableId: indicators.population.id },
            ],
            "xAxis.scaleType": "log",
            "xAxis.canChangeScaleType": true,
        })
    })

    test("adding a scatter plot keeps an existing x indicator and its linear axis", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(
                marimekkoChart({
                    x: indicators.population,
                    y: indicators.lifeExpectancy,
                })
            )
        )

        await chartTypeTag(editor, "Scatter plot").click()

        expect(await editor.saveChanges()).toEqual({
            chartTypes: ["Marimekko", "ScatterPlot"],
            dimensions: [
                y(indicators.lifeExpectancy),
                x(indicators.population),
                { property: "color", variableId: indicators.continents.id },
                { property: "size", variableId: indicators.population.id },
            ],
        })
    })

    test("switching to a Marimekko stacks relatively and shows the relative toggle", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(stackedAreaChart(indicators.lifeExpectancy))
        )

        await chartTypeTag(editor, "Marimekko chart").click()

        expect(await editor.saveChanges()).toEqual({
            chartTypes: ["Marimekko"],
            stackMode: "relative",
            hideRelativeToggle: false,
        })
    })

    test("switching a multi-indicator chart to a line chart narrows the selection to World", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...stackedAreaChart(
                    indicators.lifeExpectancy,
                    indicators.childMortality
                ),
                selectedEntityNames: [
                    entities.france.name,
                    entities.world.name,
                    entities.kenya.name,
                ],
            })
        )

        await chartTypeTag(editor, "Line chart").click()

        expect(await editor.saveChanges()).toEqual({
            chartTypes: ["LineChart"],
            selectedEntityNames: [entities.world.name],
            addCountryMode: "change-country",
        })
    })

    test("switching a multi-indicator chart to a line chart keeps the first entity when World isn't selected", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...stackedAreaChart(
                    indicators.lifeExpectancy,
                    indicators.childMortality
                ),
                selectedEntityNames: [
                    entities.kenya.name,
                    entities.france.name,
                ],
            })
        )

        await chartTypeTag(editor, "Line chart").click()

        expect(await editor.saveChanges()).toEqual({
            chartTypes: ["LineChart"],
            selectedEntityNames: [entities.kenya.name],
            addCountryMode: "change-country",
        })
    })

    test("switching to a stacked chart selects all entities when none are selected", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.coalEmissions),
                selectedEntityNames: [],
            })
        )

        await chartTypeTag(editor, "Area chart").click()

        expect(await editor.saveChanges()).toEqual({
            chartTypes: ["StackedArea"],
            selectedEntityNames: [
                entities.brazil.name,
                entities.france.name,
                entities.germany.name,
                entities.india.name,
                entities.japan.name,
                entities.kenya.name,
                entities.nigeria.name,
            ],
        })
    })

    test("the map toggle adds a map tab", async ({ seedChart, openEditor }) => {
        const editor = await openEditor(
            await seedChart(lineChart(indicators.lifeExpectancy))
        )
        const map = chartTypeTag(editor, "Map")
        await expect(map).not.toBeChecked()

        await map.click()

        await expect(map).toBeChecked()
        expect(await editor.saveChanges()).toEqual({ hasMapTab: true })
    })

    test("the map toggle removes an existing map tab", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                hasMapTab: true,
            })
        )
        const map = chartTypeTag(editor, "Map")
        await expect(map).toBeChecked()

        await map.click()

        expect(await editor.saveChanges()).toEqual({ hasMapTab: undefined })
    })
})

test.describe("Indicators", () => {
    test("searching the indicator selector and picking results adds them as y indicators", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(stackedAreaChart(indicators.coalEmissions))
        )
        const selector = await openIndicatorSelector(editor, "Y axis")
        await expect(selector.chosen).toHaveText([/^CO2 emissions from coal/])

        await selector.search("oil")
        await expect(
            selector.modal.locator(".searchResults").getByRole("checkbox")
        ).toHaveCount(1)
        await selector.result(indicators.oilEmissions.name).check()
        await selector.search("gas")
        await selector.result(indicators.gasEmissions.name).check()
        await expect(selector.chosen).toHaveText([
            /^CO2 emissions from coal/,
            /^CO2 emissions from oil/,
            /^CO2 emissions from gas/,
        ])
        await selector.confirm()

        await expect(slotIndicators(editor, "Y axis")).toHaveText([
            indicators.coalEmissions.name,
            indicators.oilEmissions.name,
            indicators.gasEmissions.name,
        ])
        expect(await editor.saveChanges()).toEqual({
            dimensions: [
                y(indicators.coalEmissions),
                y(indicators.oilEmissions),
                y(indicators.gasEmissions),
            ],
        })
    })

    test("the indicator selector only searches the chart's namespaces until their filter is removed", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(stackedAreaChart(indicators.coalEmissions))
        )
        const selector = await openIndicatorSelector(editor, "Y axis")

        await selector.search("GDP growth")
        await expect(selector.result(indicators.gdpGrowth.name)).toHaveCount(0)
        await selector.removeNamespace(
            indicators.coalEmissions.dataset.namespace
        )
        await selector.result(indicators.gdpGrowth.name).check()
        await selector.confirm()

        expect(await editor.saveChanges()).toEqual({
            dimensions: [y(indicators.coalEmissions), y(indicators.gdpGrowth)],
        })
    })

    test("closing the indicator selector discards the picked indicators", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(stackedAreaChart(indicators.coalEmissions))
        )
        const selector = await openIndicatorSelector(editor, "Y axis")
        await selector.search("oil")
        await selector.result(indicators.oilEmissions.name).check()

        await selector.modal.getByRole("button", { name: "Close" }).click()

        await expect(selector.modal).toHaveCount(0)
        await expect(slotIndicators(editor, "Y axis")).toHaveText([
            indicators.coalEmissions.name,
        ])
        expect(await editor.saveChanges()).toEqual({})
    })

    test("adding a second y indicator to a line chart narrows the selection to World", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                selectedEntityNames: [
                    entities.france.name,
                    entities.world.name,
                ],
            })
        )
        const selector = await openIndicatorSelector(editor, "Y axis")
        await selector.search("Child mortality")
        await selector.result(indicators.childMortality.name).check()
        await selector.confirm()

        await expect(
            editor.preview.getByText(indicators.childMortality.name)
        ).toBeVisible()
        expect(await editor.saveChanges()).toEqual({
            dimensions: [
                y(indicators.lifeExpectancy),
                y(indicators.childMortality),
            ],
            selectedEntityNames: [entities.world.name],
            addCountryMode: "change-country",
        })
    })

    test("removing a y indicator removes its dimension", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(
                stackedAreaChart(
                    indicators.coalEmissions,
                    indicators.oilEmissions
                )
            )
        )

        await removeButton(
            dimensionCard(editor, indicators.coalEmissions.name)
        ).click()

        await expect(slotIndicators(editor, "Y axis")).toHaveText([
            indicators.oilEmissions.name,
        ])
        expect(await editor.saveChanges()).toEqual({
            dimensions: [y(indicators.oilEmissions)],
        })
    })

    test("removing the second y indicator of a line chart without selection selects all entities", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.coalEmissions, indicators.oilEmissions),
                selectedEntityNames: [],
                addCountryMode: EntitySelectionMode.SingleEntity,
            })
        )

        await removeButton(
            dimensionCard(editor, indicators.oilEmissions.name)
        ).click()

        expect(await editor.saveChanges()).toEqual({
            dimensions: [y(indicators.coalEmissions)],
            selectedEntityNames: [
                entities.france.name,
                entities.germany.name,
                entities.kenya.name,
                entities.nigeria.name,
                entities.india.name,
                entities.japan.name,
                entities.brazil.name,
            ],
            addCountryMode: undefined,
        })
    })

    test("replacing the x indicator of a scatter plot picks a single indicator", async ({
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
        await replaceButton(
            dimensionCard(editor, indicators.gdpPerCapita.name)
        ).click()
        const selector = new IndicatorSelector(editor.page)
        await expect(selector.chosen).toHaveText([/^GDP per capita/])

        await selector.search("GDP growth")
        await selector.result(indicators.gdpGrowth.name).check()
        await expect(selector.chosen).toHaveText([/^GDP growth/])
        await selector.confirm()

        expect(await editor.saveChanges()).toEqual({
            dimensions: [y(indicators.lifeExpectancy), x(indicators.gdpGrowth)],
        })
    })

    test("swapping axes turns the x indicator into the y indicator and vice versa", async ({
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

        await editor.button("Swap axes").click()

        await expect(slotIndicators(editor, "X axis")).toHaveText([
            indicators.lifeExpectancy.name,
        ])
        await expect(slotIndicators(editor, "Y axis")).toHaveText([
            indicators.gdpPerCapita.name,
        ])
        expect(await editor.saveChanges()).toEqual({
            dimensions: [
                x(indicators.lifeExpectancy),
                y(indicators.gdpPerCapita),
            ],
        })
    })

    test("axes can't be swapped on a Marimekko", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(
                marimekkoChart({
                    x: indicators.population,
                    y: indicators.lifeExpectancy,
                })
            )
        )

        await expect(slotIndicators(editor, "X axis")).toHaveText([
            indicators.population.name,
        ])
        await expect(editor.button("Swap axes")).toHaveCount(0)
    })

    test("dragging a y indicator reorders the dimensions", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(
                stackedAreaChart(
                    indicators.coalEmissions,
                    indicators.oilEmissions,
                    indicators.gasEmissions
                )
            )
        )

        await dragDimensionCard(
            editor,
            indicators.coalEmissions.name,
            indicators.oilEmissions.name
        )

        await expect(slotIndicators(editor, "Y axis")).toHaveText([
            indicators.oilEmissions.name,
            indicators.coalEmissions.name,
            indicators.gasEmissions.name,
        ])
        expect(await editor.saveChanges()).toEqual({
            dimensions: [
                y(indicators.oilEmissions),
                y(indicators.coalEmissions),
                y(indicators.gasEmissions),
            ],
        })
    })

    test("adding a second y indicator drops the inherited indicator config", async ({
        seedChart,
        openEditor,
        request,
    }) => {
        const chart = await seedChart(lineChart(indicators.childMortality), {
            inheritance: true,
        })
        const editor = await openEditor(chart)
        await expect(
            editor.preview.getByText(
                indicators.childMortality.grapherConfigETL.subtitle
            )
        ).toBeVisible()
        await expect(chartTypeTag(editor, "Map")).toBeChecked()

        const selector = await openIndicatorSelector(editor, "Y axis")
        await selector.search("Life expectancy")
        await selector.result(indicators.lifeExpectancy.name).check()
        await selector.confirm()

        await expect(
            editor.preview.getByText(
                indicators.childMortality.grapherConfigETL.subtitle
            )
        ).toHaveCount(0)
        await expect(chartTypeTag(editor, "Map")).not.toBeChecked()
        expect(await editor.saveChanges()).toEqual({
            dimensions: [
                y(indicators.childMortality),
                y(indicators.lifeExpectancy),
            ],
            selectedEntityNames: [entities.france.name],
            addCountryMode: "change-country",
        })
        const config = await (
            await request.get(`/admin/api/charts/${chart.id}.config.json`)
        ).json()
        expect(config.subtitle).toBeUndefined()
        expect(config.note).toBeUndefined()
        expect(config.hasMapTab).toBeFalsy()
    })
})

test.describe("Dimension card", () => {
    const textFields = [
        { label: "Display name", field: "name", value: "Life span" },
        { label: "Unit of measurement", field: "unit", value: "years of life" },
        { label: "Short (axis) unit", field: "shortUnit", value: "yrs" },
    ]
    for (const { label, field, value } of textFields)
        test(`editing "${label}" writes display.${field}`, async ({
            seedChart,
            openEditor,
        }) => {
            const editor = await openEditor(
                await seedChart(lineChart(indicators.lifeExpectancy))
            )
            await expandDimensionCard(editor, indicators.lifeExpectancy.name)

            await editor.fill(editor.field(label), value)

            expect(await editor.saveChanges()).toEqual({
                dimensions: [y(indicators.lifeExpectancy, { [field]: value })],
            })
        })

    const numberFields = [
        {
            label: "Number of decimal places",
            field: "numDecimalPlaces",
            value: 3,
        },
        {
            label: "Unit conversion factor",
            field: "conversionFactor",
            value: 0.5,
        },
        { label: "Tolerance", field: "tolerance", value: 5 },
    ]
    for (const { label, field, value } of numberFields)
        test(`editing "${label}" writes display.${field}`, async ({
            seedChart,
            openEditor,
        }) => {
            const editor = await openEditor(
                await seedChart(lineChart(indicators.lifeExpectancy))
            )
            await expandDimensionCard(editor, indicators.lifeExpectancy.name)

            await editor.fill(editor.field(label), String(value))

            expect(await editor.saveChanges()).toEqual({
                dimensions: [y(indicators.lifeExpectancy, { [field]: value })],
            })
        })

    const toggles = [
        { label: "Is projection", display: { isProjection: true } },
        {
            label: "Plot markers only",
            display: { plotMarkersOnlyInLineChart: true },
        },
    ]
    for (const { label, display } of toggles)
        test(`ticking "${label}" writes it to the dimension's display`, async ({
            seedChart,
            openEditor,
        }) => {
            const editor = await openEditor(
                await seedChart(lineChart(indicators.lifeExpectancy))
            )
            await expandDimensionCard(editor, indicators.lifeExpectancy.name)
            const toggle = editor.checkbox(label)
            await expect(toggle).not.toBeChecked()

            await toggle.check()

            expect(await editor.saveChanges()).toEqual({
                dimensions: [y(indicators.lifeExpectancy, display)],
            })
        })

    const tableColumnToggles = [
        { label: "Hide absolute change column", field: "hideAbsoluteChange" },
        { label: "Hide relative change column", field: "hideRelativeChange" },
    ]
    for (const { label, field } of tableColumnToggles) {
        test(`ticking "${label}" writes display.tableDisplay.${field}`, async ({
            seedChart,
            openEditor,
        }) => {
            const editor = await openEditor(
                await seedChart(lineChart(indicators.lifeExpectancy))
            )
            await expandDimensionCard(editor, indicators.lifeExpectancy.name)
            const toggle = editor.checkbox(label)
            await expect(toggle).not.toBeChecked()

            await toggle.check()

            expect(await editor.saveChanges()).toEqual({
                dimensions: [
                    y(indicators.lifeExpectancy, {
                        tableDisplay: { [field]: true },
                    }),
                ],
            })
        })
    }

    test("the table column toggles add to existing table display settings", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                dimensions: [
                    y(indicators.lifeExpectancy, {
                        tableDisplay: { hideRelativeChange: true },
                    }),
                ],
            })
        )
        await expandDimensionCard(editor, indicators.lifeExpectancy.name)
        await expect(
            editor.checkbox("Hide relative change column")
        ).toBeChecked()

        await editor.checkbox("Hide absolute change column").check()

        expect(await editor.saveChanges()).toEqual({
            dimensions: [
                y(indicators.lifeExpectancy, {
                    tableDisplay: {
                        hideRelativeChange: true,
                        hideAbsoluteChange: true,
                    },
                }),
            ],
        })
    })

    test("the projection and markers toggles only show for line charts", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(discreteBarChart(indicators.lifeExpectancy))
        )
        await expandDimensionCard(editor, indicators.lifeExpectancy.name)

        await expect(
            editor.checkbox("Hide absolute change column")
        ).toBeVisible()
        await expect(editor.checkbox("Is projection")).toHaveCount(0)
        await expect(editor.checkbox("Plot markers only")).toHaveCount(0)
    })

    test("rounding to significant figures writes the rounding mode and number of figures", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(lineChart(indicators.lifeExpectancy))
        )
        await expandDimensionCard(editor, indicators.lifeExpectancy.name)
        await expect(editor.field("Number of significant figures")).toHaveCount(
            0
        )

        await editor
            .field("Rounding mode")
            .selectOption({ label: "Significant Figures" })
        await editor.fill(editor.field("Number of significant figures"), "2")

        expect(await editor.saveChanges()).toEqual({
            dimensions: [
                y(indicators.lifeExpectancy, {
                    roundingMode: OwidVariableRoundingMode.significantFigures,
                    numSignificantFigures: 2,
                }),
            ],
        })
    })

    test("the card shows the authored display settings and can bind them back to the data", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                dimensions: [
                    y(indicators.lifeExpectancy, {
                        name: "Life span",
                        numDecimalPlaces: 2,
                    }),
                ],
            })
        )
        await expandDimensionCard(editor, indicators.lifeExpectancy.name)
        await expect(editor.field("Display name")).toHaveValue("Life span")
        await expect(editor.field("Number of decimal places")).toHaveValue("2")
        await expect(editor.field("Unit of measurement")).toHaveValue(
            indicators.lifeExpectancy.unit
        )
        const bindToData = bindToDataButton(editor, "Display name")
        await expect(bindToData).toBeEnabled()

        await bindToData.click()

        await expect(bindToData, "the field is bound to data").toBeDisabled()
        expect(await editor.saveChanges()).toEqual({
            dimensions: [y(indicators.lifeExpectancy, { numDecimalPlaces: 2 })],
        })
    })

    test("binding the display name to the data shows the indicator's name", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                dimensions: [
                    y(indicators.lifeExpectancy, { name: "Life span" }),
                ],
            })
        )
        await expandDimensionCard(editor, indicators.lifeExpectancy.name)

        await bindToDataButton(editor, "Display name").click()

        await expect(editor.field("Display name")).toHaveValue(
            indicators.lifeExpectancy.name
        )
    })

    test("a display name with detail syntax blocks saving", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(lineChart(indicators.lifeExpectancy))
        )
        await expandDimensionCard(editor, indicators.lifeExpectancy.name)

        await editor.fill(
            editor.field("Display name"),
            "Life expectancy [(?)](#dod:life_expectancy)"
        )

        await expect(
            editor.form.getByText(
                "Detail syntax is not supported for display names of indicators: Life expectancy [(?)](#dod:life_expectancy)"
            )
        ).toBeVisible()
        await expect(editor.button("Save draft")).toBeDisabled()
    })

    test("picking a color from the palette writes display.color", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(discreteBarChart(indicators.lifeExpectancy))
        )

        await dimensionCard(editor, indicators.lifeExpectancy.name)
            .locator(".ColorBox")
            .click()
        await editor.page
            .getByRole("button", { name: "Denim (#4c6a9c)" })
            .click()

        expect(await editor.saveChanges()).toEqual({
            dimensions: [y(indicators.lifeExpectancy, { color: "#4c6a9c" })],
        })
    })

    test("resetting the color removes display.color", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...discreteBarChart(indicators.lifeExpectancy),
                dimensions: [
                    y(indicators.lifeExpectancy, { color: "#4c6a9c" }),
                ],
            })
        )
        const colorBox = dimensionCard(
            editor,
            indicators.lifeExpectancy.name
        ).locator(".ColorBox")
        await expect(colorBox).toHaveCSS(
            "background-color",
            "rgb(76, 106, 156)"
        )

        await colorBox.click()
        await editor.page
            .getByRole("button", { name: "Reset to color scheme default" })
            .click()

        expect(await editor.saveChanges()).toEqual({
            dimensions: [y(indicators.lifeExpectancy)],
        })
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
