/**
 * The color controls of the Customize tab: the chart-wide color scheme, and
 * for charts with a color scale (e.g. a scatter plot colored by an
 * indicator) the "Color scale" and "Color legend" sections that edit
 * `colorScale`. Categorical scales are tested on a scatter plot colored by
 * continent, numeric ones on a scatter plot colored by GDP growth (values
 * from -2 to 2).
 *
 * Numeric bins start out automatic; editing a bin switches the scale to
 * manual binning. Tests seed manual bins where the exact bin edges matter,
 * so that the expected values don't depend on the automatic binning.
 */
import type { Locator } from "@playwright/test"
import {
    ColorSchemeName,
    DimensionProperty,
    type ColorScaleConfigInterface,
    type GrapherInterface,
} from "@ourworldindata/types"
import { expect, test, type ChartEditorPage } from "./harness.js"
import { indicators } from "./fixture.js"
import {
    discreteBarChart,
    lineChart,
    scatterPlot,
    stackedAreaChart,
} from "./charts.js"

const coloredByContinent = scatterPlot({
    x: indicators.gdpPerCapita,
    y: indicators.lifeExpectancy,
    color: indicators.continents,
})

/** A discrete bar chart whose bars are colored by GDP growth */
const coloredByGrowth: GrapherInterface = {
    ...discreteBarChart(indicators.lifeExpectancy),
    dimensions: [
        {
            property: DimensionProperty.y,
            variableId: indicators.lifeExpectancy.id,
        },
        {
            property: DimensionProperty.color,
            variableId: indicators.gdpGrowth.id,
        },
    ],
}

/** Two numeric bins: -2 to 0 and 0 to 2 */
const manualBins: Partial<ColorScaleConfigInterface> = {
    binningStrategy: "manual",
    customNumericValues: [-2, 0, 2],
}

const colorScaleSection = (editor: ChartEditorPage): Locator =>
    editor.section("Color scale")
const colorLegendSection = (editor: ChartEditorPage): Locator =>
    editor.section("Color legend")

/** The editor row of a category of a categorical color scale */
const categoryBin = (editor: ChartEditorPage, category: string): Locator =>
    colorScaleSection(editor)
        .locator("li.categorical")
        .filter({
            has: editor.page.locator(`input[value="${category}"]`),
        })

/** The editor row of the n-th (1-based) bin of a numeric color scale */
const numericBin = (editor: ChartEditorPage, n: number): Locator =>
    colorScaleSection(editor)
        .locator("li.numeric")
        .nth(n - 1)

/** The input for a bin's upper bound (the last number input of the row) */
const binMax = (bin: Locator): Locator => bin.locator("input").last()

test.describe("Chart color scheme", () => {
    const multiLineChart = lineChart(
        indicators.lifeExpectancy,
        indicators.childMortality
    )

    test("choosing a color scheme writes baseColorScheme", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(await seedChart(multiLineChart))
        const form = await editor.openTab("Customize")
        const select = editor.antSelect(
            "Color scheme",
            editor.section("Color scheme", form)
        )
        await expect(select).toHaveText("Select...")

        await editor.chooseAntOption(select, "Yellow-Green shades", {
            search: true,
        })

        await expect(select).toHaveText("Yellow-Green shades")
        expect(await editor.saveChanges()).toEqual({ baseColorScheme: "YlGn" })
    })

    test("choosing the default scheme removes baseColorScheme", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...multiLineChart,
                baseColorScheme: ColorSchemeName.Magma,
            })
        )
        const form = await editor.openTab("Customize")
        const select = editor.antSelect(
            "Color scheme",
            editor.section("Color scheme", form)
        )
        await expect(select).toHaveText("Magma")

        await editor.chooseAntOption(select, "Default", { search: true })

        expect(await editor.saveChanges()).toEqual({
            baseColorScheme: undefined,
        })
    })

    test("inverting the colors writes invertColorScheme", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(await seedChart(multiLineChart))
        await editor.openTab("Customize")
        const toggle = editor.checkbox(
            "Invert colors",
            editor.section("Color scheme")
        )
        await expect(toggle).not.toBeChecked()

        await toggle.check()

        expect(await editor.saveChanges()).toEqual({ invertColorScheme: true })
    })

    test("unticking invert colors removes invertColorScheme", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({ ...multiLineChart, invertColorScheme: true })
        )
        await editor.openTab("Customize")
        const toggle = editor.checkbox(
            "Invert colors",
            editor.section("Color scheme")
        )
        await expect(toggle).toBeChecked()

        await toggle.uncheck()

        expect(await editor.saveChanges()).toEqual({
            invertColorScheme: undefined,
        })
    })
})

test.describe("Color scale", () => {
    test("stacked area charts have no color scale", async ({
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
        await editor.openTab("Customize")

        await expect(editor.section("Color scheme")).toBeVisible()
        await expect(colorScaleSection(editor)).toHaveCount(0)
        await expect(colorLegendSection(editor)).toHaveCount(0)
    })

    test("choosing a scale color scheme writes colorScale.baseColorScheme", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(await seedChart(coloredByContinent))
        await editor.openTab("Customize")
        const select = editor.antSelect(
            "Color scheme",
            colorScaleSection(editor)
        )
        await expect(select).toHaveText("Continents")

        await editor.chooseAntOption(select, "Magma", { search: true })

        expect(await editor.saveChanges()).toEqual({
            "colorScale.baseColorScheme": "Magma",
        })
    })

    test("choosing the custom scheme turns on custom colors", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(await seedChart(coloredByContinent))
        await editor.openTab("Customize")
        const select = editor.antSelect(
            "Color scheme",
            colorScaleSection(editor)
        )

        await editor.chooseAntOption(select, "Custom", { search: true })

        expect(await editor.saveChanges()).toEqual({
            "colorScale.customNumericColorsActive": true,
        })
    })

    test("choosing a scheme while custom colors are on turns them off", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...coloredByContinent,
                colorScale: {
                    customNumericColorsActive: true,
                    customCategoryColors: { Europe: "#111111" },
                },
            })
        )
        await editor.openTab("Customize")
        const select = editor.antSelect(
            "Color scheme",
            colorScaleSection(editor)
        )
        await expect(select).toHaveText("Custom")

        await editor.chooseAntOption(select, "Magma", { search: true })

        expect(await editor.saveChanges()).toEqual({
            "colorScale.baseColorScheme": "Magma",
            "colorScale.customNumericColorsActive": undefined,
        })
    })

    test("inverting the scale's colors writes colorScale.colorSchemeInvert", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(await seedChart(coloredByContinent))
        await editor.openTab("Customize")
        const toggle = editor.checkbox(
            "Invert colors",
            colorScaleSection(editor)
        )
        await expect(toggle).not.toBeChecked()

        await toggle.check()

        expect(await editor.saveChanges()).toEqual({
            "colorScale.colorSchemeInvert": true,
        })
    })
})

test.describe("Categorical color scale", () => {
    test("hiding a category writes it to customHiddenCategories", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(await seedChart(coloredByContinent))
        await editor.openTab("Customize")
        const hide = editor.checkbox("Hide", categoryBin(editor, "Europe"))
        await expect(hide).not.toBeChecked()

        await hide.check()

        expect(await editor.saveChanges()).toEqual({
            "colorScale.customHiddenCategories.Europe": true,
        })
    })

    test("unhiding a category removes it from customHiddenCategories", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...coloredByContinent,
                colorScale: { customHiddenCategories: { Africa: true } },
            })
        )
        await editor.openTab("Customize")
        const hide = editor.checkbox("Hide", categoryBin(editor, "Africa"))
        await expect(hide).toBeChecked()

        await hide.uncheck()

        expect(await editor.saveChanges()).toEqual({
            "colorScale.customHiddenCategories.Africa": undefined,
        })
    })

    test("picking a category color turns on custom colors", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(await seedChart(coloredByContinent))
        await editor.openTab("Customize")

        await editor.pickColor(
            categoryBin(editor, "Asia").locator(".ColorBox"),
            "#123456"
        )

        expect(await editor.saveChanges()).toEqual({
            "colorScale.customNumericColorsActive": true,
            "colorScale.customCategoryColors.Asia": "#123456",
        })
    })

    test("resetting a category color removes it", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...coloredByContinent,
                colorScale: {
                    customNumericColorsActive: true,
                    customCategoryColors: {
                        Asia: "#123456",
                        Europe: "#654321",
                    },
                },
            })
        )
        await editor.openTab("Customize")

        await categoryBin(editor, "Asia").locator(".ColorBox").click()
        await editor.page
            .locator(".colorpicker-tooltip")
            .getByRole("button", { name: "Reset to color scheme default" })
            .click()

        expect(await editor.saveChanges()).toEqual({
            "colorScale.customCategoryColors.Asia": undefined,
        })
    })

    test("assigning a custom label to a category writes customCategoryLabels", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(await seedChart(coloredByContinent))
        await editor.openTab("Customize")

        await editor.button("Assign custom labels").click()
        const europe = colorLegendSection(editor)
            .locator("li.BinLabelView")
            .filter({ has: editor.page.locator('input[value="Europe"]') })
        await editor.fill(europe.getByPlaceholder("Custom label"), "EU")

        // Switching to manual binning also stores the (meaningless for a
        // categorical scale) automatic numeric thresholds
        expect(await editor.saveChanges()).toEqual({
            "colorScale.binningStrategy": "manual",
            "colorScale.customNumericValues": [0],
            "colorScale.customCategoryLabels.Europe": "EU",
        })
    })
})

test.describe("Numeric color scale", () => {
    test("choosing a binning strategy writes colorScale.binningStrategy", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(await seedChart(coloredByGrowth))
        await editor.openTab("Customize")
        const select = editor.antSelect(
            "Binning strategy",
            colorScaleSection(editor)
        )
        await expect(select).toHaveText("Automatic")

        await editor.chooseAntOption(select, "Equal-size bins (fewer bins)")

        expect(await editor.saveChanges()).toEqual({
            "colorScale.binningStrategy": "equalSizeBins-few-bins",
        })
    })

    test("typing a min and max value writes them to the color scale", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(await seedChart(coloredByGrowth))
        await editor.openTab("Customize")
        const scale = colorScaleSection(editor)

        await editor.fill(editor.field("Min value", scale), "-1.5")
        await editor.fill(editor.field("Max value", scale), "3")

        expect(await editor.saveChanges()).toEqual({
            "colorScale.minValue": -1.5,
            "colorScale.maxValue": 3,
        })
    })

    test("a min value above the max value blocks saving", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(await seedChart(coloredByGrowth))
        await editor.openTab("Customize")
        const scale = colorScaleSection(editor)

        await editor.fill(editor.field("Max value", scale), "1")
        await editor.fill(editor.field("Min value", scale), "2")

        await expect(scale).toContainText(
            "Binning: minValue is greater than maxValue"
        )
        await expect(editor.button("Save draft")).toBeDisabled()
    })

    test("logarithmic binning with a negative min value blocks saving", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...coloredByGrowth,
                colorScale: { minValue: -1 },
            })
        )
        await editor.openTab("Customize")
        const scale = colorScaleSection(editor)
        await expect(editor.button("Save draft")).toBeEnabled()

        await editor.chooseAntOption(
            editor.antSelect("Binning strategy", scale),
            "Logarithmic (automatic)"
        )

        await expect(scale).toContainText(
            "Binning: Logarithmic binning requires non-zero positive minValue"
        )
        await expect(editor.button("Save draft")).toBeDisabled()
    })

    test("setting a midpoint with its own bin writes midpoint and createBinForMidpoint", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(await seedChart(coloredByGrowth))
        await editor.openTab("Customize")
        const scale = colorScaleSection(editor)

        await editor.fill(editor.field("Midpoint", scale), "1")
        await editor.checkbox("Include bin for midpoint", scale).check()

        expect(await editor.saveChanges()).toEqual({
            "colorScale.midpoint": 1,
            "colorScale.createBinForMidpoint": true,
        })
    })

    test("choosing a midpoint mode writes colorScale.midpointMode", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(await seedChart(coloredByGrowth))
        await editor.openTab("Customize")
        const select = editor.antSelect(
            "Midpoint mode",
            colorScaleSection(editor)
        )
        await expect(select).toHaveText("Automatic")

        await editor.chooseAntOption(select, "Symmetric around midpoint")

        expect(await editor.saveChanges()).toEqual({
            "colorScale.midpointMode": "symmetric",
        })
    })

    test("choosing automatic midpoint mode removes colorScale.midpointMode", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...coloredByGrowth,
                colorScale: { midpointMode: "none" },
            })
        )
        await editor.openTab("Customize")
        const select = editor.antSelect(
            "Midpoint mode",
            colorScaleSection(editor)
        )
        await expect(select).toHaveText("No midpoint")

        await editor.chooseAntOption(select, "Automatic")

        expect(await editor.saveChanges()).toEqual({
            "colorScale.midpointMode": undefined,
        })
    })

    test("the bins show the seeded manual bin edges", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({ ...coloredByGrowth, colorScale: manualBins })
        )
        await editor.openTab("Customize")

        const [first, second] = [numericBin(editor, 1), numericBin(editor, 2)]
        await expect(first.locator("input").first()).toHaveValue("-2")
        await expect(binMax(first)).toHaveValue("0")
        await expect(binMax(second)).toHaveValue("2")
    })

    test("editing a bin's upper bound writes customNumericValues", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({ ...coloredByGrowth, colorScale: manualBins })
        )
        await editor.openTab("Customize")

        await editor.fill(binMax(numericBin(editor, 1)), "0.5")

        expect(await editor.saveChanges()).toEqual({
            "colorScale.customNumericValues": [-2, 0.5, 2],
        })
    })

    test("editing the first bin's lower bound writes the first custom value", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({ ...coloredByGrowth, colorScale: manualBins })
        )
        await editor.openTab("Customize")

        await editor.fill(numericBin(editor, 1).locator("input").first(), "-3")

        expect(await editor.saveChanges()).toEqual({
            "colorScale.customNumericValues": [-3, 0, 2],
        })
    })

    test("editing an automatic bin switches to manual binning", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...coloredByGrowth,
                colorScale: {
                    binningStrategy: "equalSizeBins-few-bins",
                    minValue: -2,
                    maxValue: 2,
                },
            })
        )
        await editor.openTab("Customize")
        const select = editor.antSelect(
            "Binning strategy",
            colorScaleSection(editor)
        )

        await editor.fill(binMax(numericBin(editor, 1)), "-1.5")

        await expect(select).toHaveText("Manual")
        expect(await editor.saveChanges()).toEqual({
            "colorScale.binningStrategy": "manual",
            "colorScale.customNumericValues": [-2, -1.5, 0, 1, 2],
        })
    })

    test("adding a bin inserts a boundary halfway to the next one", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({ ...coloredByGrowth, colorScale: manualBins })
        )
        await editor.openTab("Customize")

        await numericBin(editor, 1).locator(".clickable").first().click()

        await expect(
            colorScaleSection(editor).locator("li.numeric")
        ).toHaveCount(3)
        expect(await editor.saveChanges()).toEqual({
            "colorScale.customNumericValues": [-2, -1, 0, 2],
            "colorScale.customNumericColors": [null],
        })
    })

    test("removing a bin merges it into the previous one", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...coloredByGrowth,
                colorScale: {
                    binningStrategy: "manual",
                    customNumericValues: [-2, -1, 0, 2],
                },
            })
        )
        await editor.openTab("Customize")

        await numericBin(editor, 2).locator(".clickable").last().click()

        await expect(
            colorScaleSection(editor).locator("li.numeric")
        ).toHaveCount(2)
        expect(await editor.saveChanges()).toEqual({
            "colorScale.customNumericValues": [-2, 0, 2],
        })
    })

    test("picking a bin color turns on custom colors for that bin", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({ ...coloredByGrowth, colorScale: manualBins })
        )
        await editor.openTab("Customize")

        await editor.pickColor(
            numericBin(editor, 2).locator(".ColorBox"),
            "#123456"
        )

        expect(await editor.saveChanges()).toEqual({
            "colorScale.customNumericColorsActive": true,
            "colorScale.customNumericColors": [null, "#123456"],
        })
    })

    test("assigning a custom label to a bin writes customNumericLabels", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({ ...coloredByGrowth, colorScale: manualBins })
        )
        await editor.openTab("Customize")
        const legend = colorLegendSection(editor)
        const secondBin = legend.locator("li.BinLabelView").nth(1)
        await expect(secondBin.locator("input[disabled]")).toHaveValue("0 – 2")

        await editor.fill(secondBin.getByPlaceholder("Custom label"), "Growing")

        expect(await editor.saveChanges()).toEqual({
            "colorScale.customNumericLabels": [null, "Growing"],
        })
    })
})

test.describe("Color legend", () => {
    test("editing the legend title writes colorScale.legendDescription", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(await seedChart(coloredByContinent))
        await editor.openTab("Customize")

        await editor.fill(
            editor.field("Legend title", colorLegendSection(editor)),
            "Continent"
        )

        expect(await editor.saveChanges()).toEqual({
            "colorScale.legendDescription": "Continent",
        })
    })

    test("assigning custom labels to automatic bins switches to manual binning", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...coloredByGrowth,
                colorScale: {
                    binningStrategy: "equalSizeBins-few-bins",
                    minValue: -2,
                    maxValue: 2,
                },
            })
        )
        await editor.openTab("Customize")

        await editor.button("Assign custom labels").click()

        await expect(
            colorLegendSection(editor).getByPlaceholder("Custom label")
        ).toHaveCount(4)
        expect(await editor.saveChanges()).toEqual({
            "colorScale.binningStrategy": "manual",
            "colorScale.customNumericValues": [-2, -1, 0, 1, 2],
        })
    })
})
