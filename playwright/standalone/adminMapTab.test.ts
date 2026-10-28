/**
 * The Map tab edits the chart's `map` config: which indicator the map shows,
 * its region and timeline, the color scale (scheme, binning and the
 * individual bins with their colors and labels), the tooltip, and the
 * entities the indicator doesn't apply to.
 *
 * Most tests use GDP growth, whose values range from -2 to 2, so its
 * automatic bins cover negative and positive values.
 */
import type { Locator } from "@playwright/test"
import {
    DimensionProperty,
    MapRegionName,
    ToleranceStrategy,
} from "@ourworldindata/types"
import { expect, test, type ChartEditorPage } from "./harness.js"
import { indicators } from "./fixture.js"
import { lineChart, mapChart } from "./charts.js"

/** The numeric bins of the color scale, in legend order */
const colorBins = (editor: ChartEditorPage): Locator =>
    editor.section("Color scale").locator(".ColorSchemeEditor > li.numeric")

/** The upper bound field of a numeric bin */
const binMaximum = (bin: Locator): Locator => bin.locator(".range input").last()

test.describe("Map", () => {
    test("choosing the indicator writes map.columnSlug", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...mapChart(indicators.lifeExpectancy),
                dimensions: [
                    {
                        property: DimensionProperty.y,
                        variableId: indicators.lifeExpectancy.id,
                    },
                    {
                        property: DimensionProperty.y,
                        variableId: indicators.gdpGrowth.id,
                    },
                ],
            })
        )
        await editor.openTab("Map")
        const indicator = editor.field("Indicator")
        await expect(indicator).toHaveValue(`${indicators.lifeExpectancy.id}`)

        await indicator.selectOption({ label: "GDP growth" })

        expect(await editor.saveChanges()).toEqual({
            "map.columnSlug": `${indicators.gdpGrowth.id}`,
        })
    })

    test("choosing a region writes map.region", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(mapChart(indicators.gdpGrowth))
        )
        await editor.openTab("Map")
        const region = editor.field("Region")
        await expect(region).toHaveValue("World")

        await region.selectOption({ label: "South America" })

        expect(await editor.saveChanges()).toEqual({
            "map.region": "SouthAmerica",
        })
    })
})

test.describe("Timeline", () => {
    test("setting the target year writes map.time", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(mapChart(indicators.gdpGrowth))
        )
        await editor.openTab("Map")

        await editor.fill(editor.field("Target year"), "2010")

        expect(await editor.saveChanges()).toEqual({
            "map.time": 2010,
        })
    })

    test("hiding the timeline writes map.hideTimeline", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(mapChart(indicators.gdpGrowth))
        )
        await editor.openTab("Map")
        const toggle = editor.checkbox("Hide timeline")
        await expect(toggle).not.toBeChecked()

        await toggle.check()

        expect(await editor.saveChanges()).toEqual({
            "map.hideTimeline": true,
        })
    })

    test("setting a tolerance writes map.timeTolerance and offers a strategy", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(mapChart(indicators.gdpGrowth))
        )
        await editor.openTab("Map")
        await expect(editor.field("Tolerance strategy")).toHaveCount(0)

        await editor.fill(editor.field("Tolerance of data"), "2")
        await editor.field("Tolerance strategy").selectOption({
            label: "Backwards: Only consider data points in the past",
        })

        expect(await editor.saveChanges()).toEqual({
            "map.timeTolerance": 2,
            "map.toleranceStrategy": "backwards",
        })
    })

    test("the editor shows the seeded timeline settings", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...mapChart(indicators.gdpGrowth),
                map: {
                    time: 2015,
                    hideTimeline: true,
                    timeTolerance: 3,
                    toleranceStrategy: ToleranceStrategy.forwards,
                },
            })
        )
        await editor.openTab("Map")

        await expect(editor.field("Target year")).toHaveValue("2015")
        await expect(editor.checkbox("Hide timeline")).toBeChecked()
        await expect(editor.field("Tolerance of data")).toHaveValue("3")
        await expect(editor.field("Tolerance strategy")).toHaveValue("forwards")
    })
})

test.describe("Color scale", () => {
    test("choosing a color scheme writes map.colorScale.baseColorScheme", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(mapChart(indicators.gdpGrowth))
        )
        await editor.openTab("Map")

        await editor.chooseAntOption(
            editor.antSelect("Color scheme"),
            "Red shades",
            { search: true }
        )

        await expect(editor.antSelect("Color scheme")).toContainText(
            "Red shades"
        )
        expect(await editor.saveChanges()).toEqual({
            "map.colorScale.baseColorScheme": "Reds",
        })
    })

    test("inverting the colors writes map.colorScale.colorSchemeInvert", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(mapChart(indicators.gdpGrowth))
        )
        await editor.openTab("Map")
        const toggle = editor.checkbox("Invert colors")
        await expect(toggle).not.toBeChecked()

        await toggle.check()

        expect(await editor.saveChanges()).toEqual({
            "map.colorScale.colorSchemeInvert": true,
        })
    })

    test("choosing a binning strategy writes map.colorScale.binningStrategy", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(mapChart(indicators.gdpGrowth))
        )
        await editor.openTab("Map")
        const binningStrategy = editor.antSelect("Binning strategy")
        await expect(binningStrategy).toContainText("Automatic")

        await editor.chooseAntOption(
            binningStrategy,
            "Equal-size bins (fewer bins)"
        )

        expect(await editor.saveChanges()).toEqual({
            "map.colorScale.binningStrategy": "equalSizeBins-few-bins",
        })
    })

    const numberFields = [
        { label: "Min value", path: "map.colorScale.minValue", value: -4 },
        { label: "Max value", path: "map.colorScale.maxValue", value: 4.5 },
        { label: "Midpoint", path: "map.colorScale.midpoint", value: 0.5 },
    ]
    for (const row of numberFields) {
        test(`setting the ${row.label.toLowerCase()} writes ${row.path}`, async ({
            seedChart,
            openEditor,
        }) => {
            const editor = await openEditor(
                await seedChart(mapChart(indicators.gdpGrowth))
            )
            await editor.openTab("Map")

            await editor.fill(editor.field(row.label), `${row.value}`)

            expect(await editor.saveChanges()).toEqual({
                [row.path]: row.value,
            })
        })
    }

    test("including a bin for the midpoint writes map.colorScale.createBinForMidpoint", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(mapChart(indicators.gdpGrowth))
        )
        await editor.openTab("Map")
        const toggle = editor.checkbox("Include bin for midpoint")
        await expect(toggle).not.toBeChecked()

        await toggle.check()

        expect(await editor.saveChanges()).toEqual({
            "map.colorScale.createBinForMidpoint": true,
        })
    })

    test("choosing a midpoint mode writes map.colorScale.midpointMode", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(mapChart(indicators.gdpGrowth))
        )
        await editor.openTab("Map")
        const midpointMode = editor.antSelect("Midpoint mode")
        await expect(midpointMode).toContainText("Automatic")

        await editor.chooseAntOption(midpointMode, "Symmetric around midpoint")

        expect(await editor.saveChanges()).toEqual({
            "map.colorScale.midpointMode": "symmetric",
        })
    })

    test("choosing the automatic midpoint mode removes the setting", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...mapChart(indicators.gdpGrowth),
                map: { colorScale: { midpointMode: "asymmetric" } },
            })
        )
        await editor.openTab("Map")
        const midpointMode = editor.antSelect("Midpoint mode")
        await expect(midpointMode).toContainText("Asymmetric around midpoint")

        await editor.chooseAntOption(midpointMode, "Automatic")

        expect(await editor.saveChanges()).toEqual({
            "map.colorScale.midpointMode": undefined,
        })
    })

    test("logarithmic binning with a non-positive minimum blocks saving", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...mapChart(indicators.gdpGrowth),
                map: { colorScale: { binningStrategy: "log-auto" } },
            })
        )
        await editor.openTab("Map")

        await editor.fill(editor.field("Min value"), "-1")

        await expect(editor.section("Color scale")).toContainText(
            "Binning: Logarithmic binning requires non-zero positive minValue"
        )
        await expect(editor.button("Save draft")).toBeDisabled()
    })

    test("a minimum above the maximum blocks saving", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...mapChart(indicators.gdpGrowth),
                map: { colorScale: { maxValue: 2 } },
            })
        )
        await editor.openTab("Map")

        await editor.fill(editor.field("Min value"), "3")

        await expect(editor.section("Color scale")).toContainText(
            "Binning: minValue is greater than maxValue"
        )
        await expect(editor.button("Save draft")).toBeDisabled()
    })
})

test.describe("Color scale bins", () => {
    test("the bin editor shows manual bins from the config", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...mapChart(indicators.gdpGrowth),
                map: {
                    colorScale: {
                        binningStrategy: "manual",
                        customNumericValues: [-2, 0, 2],
                    },
                },
            })
        )
        await editor.openTab("Map")
        const bins = colorBins(editor)

        await expect(bins).toHaveCount(2)
        await expect(bins.nth(0).locator(".range input").first()).toHaveValue(
            "-2"
        )
        await expect(binMaximum(bins.nth(0))).toHaveValue("0")
        await expect(binMaximum(bins.nth(1))).toHaveValue("2")
    })

    test("editing a bin's upper bound writes manual bins", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...mapChart(indicators.gdpGrowth),
                map: {
                    colorScale: {
                        binningStrategy: "manual",
                        customNumericValues: [-2, 0, 2],
                    },
                },
            })
        )
        await editor.openTab("Map")

        await editor.fill(binMaximum(colorBins(editor).nth(0)), "1")

        expect(await editor.saveChanges()).toEqual({
            "map.colorScale.customNumericValues": [-2, 1, 2],
        })
    })

    test("editing the lowest bound writes the first manual bin value", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...mapChart(indicators.gdpGrowth),
                map: {
                    colorScale: {
                        binningStrategy: "manual",
                        customNumericValues: [-2, 0, 2],
                    },
                },
            })
        )
        await editor.openTab("Map")

        await editor.fill(
            colorBins(editor).nth(0).locator(".range input").first(),
            "-3"
        )

        expect(await editor.saveChanges()).toEqual({
            "map.colorScale.customNumericValues": [-3, 0, 2],
        })
    })

    test("adding a bin splits the bin after it in half", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...mapChart(indicators.gdpGrowth),
                map: {
                    colorScale: {
                        binningStrategy: "manual",
                        customNumericValues: [-2, 0, 2],
                    },
                },
            })
        )
        await editor.openTab("Map")

        await colorBins(editor).nth(0).locator(".clickable").first().click()

        await expect(colorBins(editor)).toHaveCount(3)
        expect(await editor.saveChanges()).toEqual({
            "map.colorScale.customNumericValues": [-2, -1, 0, 2],
            // JSON has no undefined array entries
            "map.colorScale.customNumericColors": [null],
        })
    })

    test("removing a bin removes its bound", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...mapChart(indicators.gdpGrowth),
                map: {
                    colorScale: {
                        binningStrategy: "manual",
                        customNumericValues: [-2, 0, 1, 2],
                    },
                },
            })
        )
        await editor.openTab("Map")
        await expect(colorBins(editor)).toHaveCount(3)

        await colorBins(editor).nth(1).locator(".clickable").last().click()

        await expect(colorBins(editor)).toHaveCount(2)
        expect(await editor.saveChanges()).toEqual({
            "map.colorScale.customNumericValues": [-2, 1, 2],
        })
    })

    test("editing an automatic bin switches to manual bins", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(mapChart(indicators.gdpGrowth))
        )
        await editor.openTab("Map")

        await editor.fill(binMaximum(colorBins(editor).nth(0)), "-1.9")

        await expect(editor.antSelect("Binning strategy")).toContainText(
            "Manual"
        )
        expect(await editor.saveChanges()).toEqual({
            "map.colorScale.binningStrategy": "manual",
            // the automatic bins, with the edited upper bound of the first
            "map.colorScale.customNumericValues": [
                -2, -1.9, -1.6, -1.4, -1.2, -1, 0, 1, 1.2, 1.4, 1.6, 1.8, 2,
            ],
        })
    })

    test("picking a bin color writes custom colors", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...mapChart(indicators.gdpGrowth),
                map: {
                    colorScale: {
                        binningStrategy: "manual",
                        customNumericValues: [-2, 0, 2],
                    },
                },
            })
        )
        await editor.openTab("Map")

        await editor.pickColor(
            colorBins(editor).nth(1).locator(".ColorBox"),
            "#aa0000"
        )

        await expect(editor.antSelect("Color scheme")).toContainText("Custom")
        expect(await editor.saveChanges()).toEqual({
            "map.colorScale.customNumericColorsActive": true,
            "map.colorScale.customNumericColors": [null, "#AA0000"],
        })
    })

    test("resetting a bin color to the scheme default removes it", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...mapChart(indicators.gdpGrowth),
                map: {
                    colorScale: {
                        binningStrategy: "manual",
                        customNumericValues: [-2, 0, 2],
                        customNumericColorsActive: true,
                        customNumericColors: ["#0000aa", "#aa0000"],
                    },
                },
            })
        )
        await editor.openTab("Map")
        await expect(editor.antSelect("Color scheme")).toContainText("Custom")

        await colorBins(editor).nth(1).locator(".ColorBox").click()
        await editor.page
            .getByRole("button", { name: "Reset to color scheme default" })
            .click()

        expect(await editor.saveChanges()).toEqual({
            "map.colorScale.customNumericColors": ["#0000aa", null],
        })
    })

    test("choosing a color scheme turns custom colors off", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...mapChart(indicators.gdpGrowth),
                map: {
                    colorScale: {
                        binningStrategy: "manual",
                        customNumericValues: [-2, 0, 2],
                        customNumericColorsActive: true,
                        customNumericColors: ["#0000aa", "#aa0000"],
                    },
                },
            })
        )
        await editor.openTab("Map")

        await editor.chooseAntOption(
            editor.antSelect("Color scheme"),
            "Red shades",
            { search: true }
        )

        expect(await editor.saveChanges()).toEqual({
            "map.colorScale.baseColorScheme": "Reds",
            "map.colorScale.customNumericColorsActive": undefined,
        })
    })
})

test.describe("Categorical color scale", () => {
    /** The bin of a category of an ordinal indicator */
    const categoryBin = (editor: ChartEditorPage, category: string): Locator =>
        editor
            .section("Color scale")
            .locator(".ColorSchemeEditor > li.categorical")
            .filter({ has: editor.page.locator(`input[value="${category}"]`) })

    test("picking a category color writes custom category colors", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(mapChart(indicators.continents))
        )
        await editor.openTab("Map")

        await editor.pickColor(
            categoryBin(editor, "Europe").locator(".ColorBox"),
            "#00aa00"
        )

        expect(await editor.saveChanges()).toEqual({
            "map.colorScale.customNumericColorsActive": true,
            "map.colorScale.customCategoryColors.Europe": "#00AA00",
        })
    })

    test("hiding a category writes custom hidden categories", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(mapChart(indicators.continents))
        )
        await editor.openTab("Map")
        const hide = editor.checkbox("Hide", categoryBin(editor, "Asia"))
        await expect(hide).not.toBeChecked()

        await hide.check()

        expect(await editor.saveChanges()).toEqual({
            "map.colorScale.customHiddenCategories.Asia": true,
        })
    })

    test("showing a hidden category removes it from the hidden categories", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...mapChart(indicators.continents),
                map: {
                    colorScale: {
                        customHiddenCategories: { Asia: true, Africa: true },
                    },
                },
            })
        )
        await editor.openTab("Map")
        const hide = editor.checkbox("Hide", categoryBin(editor, "Asia"))
        await expect(hide).toBeChecked()

        await hide.uncheck()

        expect(await editor.saveChanges()).toEqual({
            "map.colorScale.customHiddenCategories.Asia": undefined,
        })
    })
})

test("saving a color scale edit shows when it was last edited", async ({
    seedChart,
    openEditor,
}) => {
    const editor = await openEditor(
        await seedChart(mapChart(indicators.gdpGrowth))
    )
    await editor.openTab("Map")
    await expect(editor.section("Color scale")).not.toContainText("Last edited")

    await editor.checkbox("Invert colors").check()
    await editor.save()

    await expect(editor.section("Color scale")).toContainText("Last edited")
})

test.describe("Inheritance", () => {
    // renewablesShare's ETL config has a map tab with the Reds color scheme
    test("a chart without map settings of its own inherits the indicator's", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(lineChart(indicators.renewablesShare), {
                inheritance: true,
            })
        )
        await editor.openTab("Map")

        await expect(editor.section("Inheritance")).toContainText(
            "All map settings are currently inherited."
        )
        await expect(editor.button("Reset all map settings")).toHaveCount(0)
        await expect(editor.antSelect("Color scheme")).toContainText(
            "Red shades"
        )
    })

    test("resetting all map settings drops the chart's own ones", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(
                {
                    ...lineChart(indicators.renewablesShare),
                    map: { region: MapRegionName.Europe },
                },
                { inheritance: true }
            )
        )
        await editor.openTab("Map")
        const section = editor.section("Inheritance")
        await expect(section).toContainText(
            "Some map settings overwrite the automatic defaults."
        )

        await editor.button("Reset all map settings", section).click()

        await expect(section).toContainText(
            "All map settings are currently inherited."
        )
        await editor.save()
        expect(await editor.storedChanges()).toEqual({
            "map.region": undefined,
        })
    })
})

test.describe("Color legend", () => {
    test("assigning custom labels switches to manual bins", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(mapChart(indicators.gdpGrowth))
        )
        await editor.openTab("Map")

        await editor
            .button("Assign custom labels", editor.section("Color legend"))
            .click()

        await expect(editor.antSelect("Binning strategy")).toContainText(
            "Manual"
        )
        expect(await editor.saveChanges()).toEqual({
            "map.colorScale.binningStrategy": "manual",
            // the automatic bins
            "map.colorScale.customNumericValues": [
                -2, -1.8, -1.6, -1.4, -1.2, -1, 0, 1, 1.2, 1.4, 1.6, 1.8, 2,
            ],
        })
    })

    test("labelling a bin writes map.colorScale.customNumericLabels", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...mapChart(indicators.gdpGrowth),
                map: {
                    colorScale: {
                        binningStrategy: "manual",
                        customNumericValues: [-2, 0, 2],
                    },
                },
            })
        )
        await editor.openTab("Map")
        const labels = editor
            .section("Color legend")
            .getByPlaceholder("Custom label")
        // two numeric bins plus the "No data" bin
        await expect(labels).toHaveCount(3)

        await editor.fill(labels.nth(1), "Growth")

        expect(await editor.saveChanges()).toEqual({
            "map.colorScale.customNumericLabels": [null, "Growth"],
        })
    })
})

test.describe("Tooltip", () => {
    test("showing custom labels in the tooltip writes map.tooltipUseCustomLabels", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(mapChart(indicators.gdpGrowth))
        )
        await editor.openTab("Map")
        const toggle = editor.checkbox(
            "Show custom label in the tooltip, instead of the numeric value"
        )
        await expect(toggle).not.toBeChecked()

        await toggle.check()

        expect(await editor.saveChanges()).toEqual({
            "map.tooltipUseCustomLabels": true,
        })
    })
})

test.describe("Not applicable entities", () => {
    test("marking an entity as not applicable writes inapplicableEntityNames", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(mapChart(indicators.gdpGrowth))
        )
        await editor.openTab("Map")
        const select = editor
            .section("Not applicable entities")
            .locator(".ant-select")

        await select.click()
        await select.locator("input").fill("Mexico")
        await editor.page
            .locator(".ant-select-dropdown:visible .ant-select-item-option")
            .filter({ hasText: /^Mexico$/ })
            .click()

        expect(await editor.saveChanges()).toEqual({
            inapplicableEntityNames: ["Mexico"],
        })
    })

    test("removing a not applicable entity removes it from the list", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...mapChart(indicators.gdpGrowth),
                inapplicableEntityNames: ["Mexico", "Canada"],
            })
        )
        await editor.openTab("Map")
        const section = editor.section("Not applicable entities")
        await expect(section.locator(".ant-select-selection-item")).toHaveText([
            "Mexico",
            "Canada",
        ])

        await section
            .locator(".ant-select-selection-item")
            .filter({ hasText: "Mexico" })
            .locator(".ant-select-selection-item-remove")
            .click()

        expect(await editor.saveChanges()).toEqual({
            inapplicableEntityNames: ["Canada"],
        })
    })
})
