/**
 * The Customize tab edits how a chart presents its data: axes, the time
 * range, facets, sorting, legend and controls, comparison lines and the
 * dumbbell settings. Each test drives one control on a chart type that shows
 * it and checks that saving writes exactly the matching config fields.
 * Colors (the chart's color scheme and its color scale) are covered in
 * `customizeTab.colors.test.ts`.
 *
 * Which sections show for which chart types is decided by
 * `adminSiteClient/EditorFeatures.tsx`; a few of its important rules have a
 * test of their own.
 */
import type { Locator } from "@playwright/test"
import { FacetAxisDomain, FacetStrategy, SortBy } from "@ourworldindata/types"
import { expect, test, type ChartEditorPage } from "./harness.js"
import { indicators } from "./fixture.js"
import {
    discreteBarChart,
    dumbbellChart,
    lineChart,
    marimekkoChart,
    scatterPlot,
    stackedAreaChart,
    stackedDiscreteBarChart,
} from "./charts.js"

const scatter = scatterPlot({
    x: indicators.gdpPerCapita,
    y: indicators.lifeExpectancy,
})

/** The input of a Min/Max field, which exist in both axis sections */
const axisField = (
    editor: ChartEditorPage,
    axis: "X Axis" | "Y Axis",
    label: string
): Locator => editor.field(label, editor.section(axis))

/** The "Bind to data" button next to a labelled number field */
const resetButtonOf = (field: Locator): Locator =>
    field.locator(
        "xpath=ancestor::div[contains(@class, 'WithResetButton')][1]//button[contains(@class, 'ResetToDefaultButton')]"
    )

test.describe("Y axis", () => {
    test("typing a min and max writes yAxis.min and yAxis.max", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(lineChart(indicators.lifeExpectancy))
        )
        await editor.openTab("Customize")

        await editor.fill(axisField(editor, "Y Axis", "Min"), "-10")
        await editor.fill(axisField(editor, "Y Axis", "Max"), "95.5")

        expect(await editor.saveChanges()).toEqual({
            "yAxis.min": -10,
            "yAxis.max": 95.5,
        })
    })

    test("binding the min to data writes yAxis.min 'auto'", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                yAxis: { min: 40 },
            })
        )
        await editor.openTab("Customize")
        const min = axisField(editor, "Y Axis", "Min")
        await expect(min).toHaveValue("40")

        await resetButtonOf(min).click()

        await expect(min).toHaveValue("Infinity")
        expect(await editor.saveChanges()).toEqual({ "yAxis.min": "auto" })
    })

    test("binding the max to data removes yAxis.max", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                yAxis: { max: 90 },
            })
        )
        await editor.openTab("Customize")
        const max = axisField(editor, "Y Axis", "Max")
        await expect(max).toHaveValue("90")

        await resetButtonOf(max).click()

        expect(await editor.saveChanges()).toEqual({ "yAxis.max": undefined })
    })

    test("enabling the log/linear selector writes yAxis.canChangeScaleType", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(lineChart(indicators.lifeExpectancy))
        )
        await editor.openTab("Customize")
        const toggle = editor.checkbox(
            "Enable log/linear selector",
            editor.section("Y Axis")
        )
        await expect(toggle).not.toBeChecked()

        await toggle.check()

        expect(await editor.saveChanges()).toEqual({
            "yAxis.canChangeScaleType": true,
        })
    })

    test("switching the preview to a log scale writes yAxis.scaleType", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                yAxis: { canChangeScaleType: true },
            })
        )
        await editor.openTab("Customize")

        await editor.preview
            .getByRole("button", { name: "Chart settings" })
            .click()
        const settingsMenu = editor.page.getByRole("dialog")
        await settingsMenu.getByRole("button", { name: "Logarithmic" }).click()
        await editor.page.keyboard.press("Escape")
        await expect(settingsMenu).toHaveCount(0)

        expect(await editor.saveChanges()).toEqual({
            "yAxis.scaleType": "log",
        })
    })

    test("unticking remove points outside domain removes the setting", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...scatter,
                yAxis: { removePointsOutsideDomain: true },
            })
        )
        await editor.openTab("Customize")
        const toggle = editor.checkbox(
            "Remove points outside domain",
            editor.section("Y Axis")
        )
        await expect(toggle).toBeChecked()

        await toggle.uncheck()

        expect(await editor.saveChanges()).toEqual({
            "yAxis.removePointsOutsideDomain": undefined,
        })
    })

    test("editing the y-axis label of a scatter plot writes yAxis.label", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(await seedChart(scatter))
        await editor.openTab("Customize")

        await editor.fill(
            editor.field("Label", editor.section("Y Axis")),
            "  Years lived  "
        )

        expect(await editor.saveChanges()).toEqual({
            "yAxis.label": "Years lived",
        })
    })

    test("a y-axis label referencing an unknown DoD blocks saving", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(await seedChart(scatter))
        const form = await editor.openTab("Customize")

        await editor.fill(
            editor.field("Label", editor.section("Y Axis")),
            "Years [lived](#dod:not_a_real_term)"
        )

        await expect(editor.section("Y Axis", form)).toContainText(
            "Invalid DoD(s) specified: not_a_real_term"
        )
        await expect(editor.button("Save draft")).toBeDisabled()
    })

    test("only scatter plots can remove points or relabel the y-axis", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(lineChart(indicators.lifeExpectancy))
        )
        await editor.openTab("Customize")
        const yAxis = editor.section("Y Axis")

        await expect(yAxis.getByText("Min", { exact: true })).toBeVisible()
        await expect(
            editor.checkbox("Remove points outside domain", yAxis)
        ).toHaveCount(0)
        await expect(editor.field("Label", yAxis)).toHaveCount(0)
    })
})

test.describe("X axis", () => {
    test("typing a min and max writes xAxis.min and xAxis.max", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(await seedChart(scatter))
        await editor.openTab("Customize")

        await editor.fill(axisField(editor, "X Axis", "Min"), "1000")
        await editor.fill(axisField(editor, "X Axis", "Max"), "50000")

        expect(await editor.saveChanges()).toEqual({
            "xAxis.min": 1000,
            "xAxis.max": 50000,
        })
    })

    test("binding the x-axis min to data removes xAxis.min", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({ ...scatter, xAxis: { min: 1000 } })
        )
        await editor.openTab("Customize")
        const min = axisField(editor, "X Axis", "Min")
        await expect(min).toHaveValue("1000")

        await resetButtonOf(min).click()

        await expect(min).toHaveValue("")
        await expect(resetButtonOf(min)).toBeDisabled()
        expect(await editor.saveChanges()).toEqual({ "xAxis.min": undefined })
    })

    const xAxisToggles = [
        {
            name: "removing points outside the x domain writes xAxis.removePointsOutsideDomain",
            label: "Remove points outside domain",
            change: { "xAxis.removePointsOutsideDomain": true },
        },
        {
            name: "enabling the x-axis log/linear selector writes xAxis.canChangeScaleType",
            label: "Enable log/linear selector",
            change: { "xAxis.canChangeScaleType": true },
        },
    ]
    for (const row of xAxisToggles)
        test(row.name, async ({ seedChart, openEditor }) => {
            const editor = await openEditor(await seedChart(scatter))
            await editor.openTab("Customize")
            const toggle = editor.checkbox(row.label, editor.section("X Axis"))
            await expect(toggle).not.toBeChecked()

            await toggle.check()

            expect(await editor.saveChanges()).toEqual(row.change)
        })

    test("editing the x-axis label writes xAxis.label", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(lineChart(indicators.lifeExpectancy))
        )
        await editor.openTab("Customize")

        await editor.fill(
            editor.field("Label", editor.section("X Axis")),
            "Year"
        )

        expect(await editor.saveChanges()).toEqual({ "xAxis.label": "Year" })
    })

    test("line charts can only relabel the x-axis, not scale it", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(lineChart(indicators.lifeExpectancy))
        )
        await editor.openTab("Customize")
        const xAxis = editor.section("X Axis")

        await expect(editor.field("Label", xAxis)).toBeVisible()
        await expect(editor.field("Min", xAxis)).toHaveCount(0)
        await expect(
            editor.checkbox("Enable log/linear selector", xAxis)
        ).toHaveCount(0)
    })

    test("marimekko charts can scale the x-axis but not change its scale type", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(
                marimekkoChart({
                    x: indicators.population,
                    y: indicators.gdpPerCapita,
                })
            )
        )
        await editor.openTab("Customize")
        const xAxis = editor.section("X Axis")

        await expect(editor.field("Min", xAxis)).toBeVisible()
        await expect(
            editor.checkbox("Enable log/linear selector", xAxis)
        ).toHaveCount(0)
    })

    test("discrete bar charts have no x-axis settings", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(discreteBarChart(indicators.lifeExpectancy))
        )
        await editor.openTab("Customize")

        await expect(editor.section("Y Axis")).toBeVisible()
        await expect(editor.section("X Axis")).toHaveCount(0)
    })
})

test.describe("Timeline selection", () => {
    test("typing a selection start and end writes minTime and maxTime", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(lineChart(indicators.lifeExpectancy))
        )
        await editor.openTab("Customize")

        await editor.fill(editor.field("Selection start"), "2005")
        await editor.fill(editor.field("Selection end"), "2015")

        expect(await editor.saveChanges()).toEqual({
            minTime: 2005,
            maxTime: 2015,
        })
    })

    test("binding the selection start to data removes minTime", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                minTime: 2005,
            })
        )
        await editor.openTab("Customize")
        const start = editor.field("Selection start")
        await expect(start).toHaveValue("2005")

        await resetButtonOf(start).click()

        await expect(start).toHaveValue("-Infinity")
        expect(await editor.saveChanges()).toEqual({ minTime: undefined })
    })

    test("clearing the selection end falls back to the latest year", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                maxTime: 2015,
            })
        )
        await editor.openTab("Customize")
        const end = editor.field("Selection end")

        await editor.fill(end, "")

        await expect(end).toHaveValue("Infinity")
        expect(await editor.saveChanges()).toEqual({ maxTime: undefined })
    })

    test("typing timeline bounds writes timelineMinTime and timelineMaxTime", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(lineChart(indicators.lifeExpectancy))
        )
        await editor.openTab("Customize")

        await editor.fill(editor.field("Timeline min"), "2002")
        await editor.fill(editor.field("Timeline max"), "2018")

        expect(await editor.saveChanges()).toEqual({
            timelineMinTime: 2002,
            timelineMaxTime: 2018,
        })
    })

    test("a discrete bar chart only selects a single year, written to maxTime", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(discreteBarChart(indicators.lifeExpectancy))
        )
        await editor.openTab("Customize")
        await expect(editor.field("Selection start")).toHaveCount(0)

        await editor.fill(editor.field("Selected year"), "2010")

        expect(await editor.saveChanges()).toEqual({ maxTime: 2010 })
    })

    test("hiding the timeline writes hideTimeline", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(lineChart(indicators.lifeExpectancy))
        )
        await editor.openTab("Customize")
        const toggle = editor.checkbox("Hide timeline")
        await expect(toggle).not.toBeChecked()

        await toggle.check()

        expect(await editor.saveChanges()).toEqual({ hideTimeline: true })
    })

    // Axis labels can't be inherited in practice: they're only editable on
    // scatter plots, which never have a parent indicator.
    test("an inherited selection start can be overridden and linked back", async ({
        seedChart,
        openEditor,
    }) => {
        // renewablesShare's ETL config starts the selection in 2005
        const editor = await openEditor(
            await seedChart(lineChart(indicators.renewablesShare), {
                inheritance: true,
            })
        )
        await editor.openTab("Customize")
        const start = editor.field("Selection start")
        const linkButton = start
            .locator("xpath=..")
            .locator(".input-group-append button")
        await expect(start).toHaveValue("")
        await expect(start).toHaveAttribute("placeholder", "2005")
        await expect(linkButton).toBeDisabled()

        await editor.fill(start, "2010")

        await expect(linkButton).toBeEnabled()
        await editor.save()
        expect(await editor.storedChanges()).toEqual({ minTime: 2010 })

        await linkButton.click()

        await expect(start).toHaveAttribute("placeholder", "2005")
        await editor.save()
        expect(await editor.storedChanges()).toEqual({})
    })

    test("always showing year labels on a discrete bar chart writes showYearLabels", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(discreteBarChart(indicators.lifeExpectancy))
        )
        await editor.openTab("Customize")
        const toggle = editor.checkbox("Always show year labels")
        await expect(toggle).not.toBeChecked()

        await toggle.check()

        expect(await editor.saveChanges()).toEqual({ showYearLabels: true })
    })

    test("unticking always show year labels removes showYearLabels", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...discreteBarChart(indicators.lifeExpectancy),
                showYearLabels: true,
            })
        )
        await editor.openTab("Customize")
        const toggle = editor.checkbox("Always show year labels")
        await expect(toggle).toBeChecked()

        await toggle.uncheck()

        expect(await editor.saveChanges()).toEqual({
            showYearLabels: undefined,
        })
    })
})

test.describe("Faceting", () => {
    const multiIndicatorLineChart = lineChart(
        indicators.lifeExpectancy,
        indicators.childMortality
    )

    test("choosing a facet strategy writes selectedFacetStrategy", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(multiIndicatorLineChart)
        )
        const form = await editor.openTab("Customize")
        const select = editor.antSelect(
            "Faceting strategy",
            editor.section("Faceting", form)
        )
        await expect(select).toHaveText("auto")

        await editor.chooseAntOption(select, "metric")

        await expect(select).toHaveText("metric")
        expect(await editor.saveChanges()).toEqual({
            selectedFacetStrategy: "metric",
        })
    })

    test("choosing auto faceting removes selectedFacetStrategy", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...multiIndicatorLineChart,
                selectedFacetStrategy: FacetStrategy.entity,
            })
        )
        const form = await editor.openTab("Customize")
        const select = editor.antSelect(
            "Faceting strategy",
            editor.section("Faceting", form)
        )
        await expect(select).toHaveText("entity")

        await editor.chooseAntOption(select, "auto")

        expect(await editor.saveChanges()).toEqual({
            selectedFacetStrategy: undefined,
        })
    })

    test("showing the facet control writes hideFacetControl false", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(multiIndicatorLineChart)
        )
        await editor.openTab("Customize")
        const toggle = editor.checkbox("Hide facet control")
        await expect(toggle).toBeChecked()

        await toggle.uncheck()

        expect(await editor.saveChanges()).toEqual({ hideFacetControl: false })
    })

    test("unticking uniform y-axis makes facets independent", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...multiIndicatorLineChart,
                yAxis: { facetDomain: FacetAxisDomain.shared },
            })
        )
        await editor.openTab("Customize")
        const toggle = editor.checkbox("Facets have uniform y-axis")
        await expect(toggle).toBeChecked()

        await toggle.uncheck()

        expect(await editor.saveChanges()).toEqual({
            "yAxis.facetDomain": "independent",
        })
    })

    test("ticking uniform y-axis writes yAxis.facetDomain shared", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...multiIndicatorLineChart,
                yAxis: { facetDomain: FacetAxisDomain.independent },
            })
        )
        await editor.openTab("Customize")
        const toggle = editor.checkbox("Facets have uniform y-axis")
        await expect(toggle).not.toBeChecked()

        await toggle.check()

        expect(await editor.saveChanges()).toEqual({
            "yAxis.facetDomain": undefined,
        })
    })
})

test.describe("Sort order", () => {
    test("choosing a sort key writes sortBy", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(discreteBarChart(indicators.lifeExpectancy))
        )
        const form = await editor.openTab("Customize")
        const select = editor.antSelect(
            "Sort by",
            editor.section("Sort Order", form)
        )
        await expect(select).toHaveText("Total value")

        await editor.chooseAntOption(select, "Entity name")

        await expect(select).toHaveText("Entity name")
        expect(await editor.saveChanges()).toEqual({ sortBy: "entityName" })
    })

    test("sorting by one indicator of several writes sortBy column and its slug", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(
                stackedDiscreteBarChart(
                    indicators.coalEmissions,
                    indicators.oilEmissions
                )
            )
        )
        const form = await editor.openTab("Customize")
        const select = editor.antSelect(
            "Sort by",
            editor.section("Sort Order", form)
        )

        await editor.chooseAntOption(
            select,
            // the option renders the indicator name twice (label and title)
            /^CO2 emissions from oil/
        )

        expect(await editor.saveChanges()).toEqual({
            sortBy: "column",
            sortColumnSlug: String(indicators.oilEmissions.id),
        })
    })

    test("a seeded column sort shows that indicator; switching away removes the slug", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...stackedDiscreteBarChart(
                    indicators.coalEmissions,
                    indicators.oilEmissions
                ),
                sortBy: SortBy.column,
                sortColumnSlug: String(indicators.coalEmissions.id),
            })
        )
        const form = await editor.openTab("Customize")
        const select = editor.antSelect(
            "Sort by",
            editor.section("Sort Order", form)
        )
        await expect(select).toHaveText("CO2 emissions from coal")

        await editor.chooseAntOption(select, "Entity name")

        expect(await editor.saveChanges()).toEqual({
            sortBy: "entityName",
            sortColumnSlug: undefined,
        })
    })

    test("choosing ascending order writes sortOrder", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(discreteBarChart(indicators.lifeExpectancy))
        )
        await editor.openTab("Customize")
        await expect(editor.radio("Descending")).toBeChecked()

        await editor.radio("Ascending").check()

        expect(await editor.saveChanges()).toEqual({ sortOrder: "asc" })
    })

    test("line charts have no sort order", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(lineChart(indicators.lifeExpectancy))
        )
        await editor.openTab("Customize")

        await expect(editor.section("Timeline selection")).toBeVisible()
        await expect(editor.section("Sort Order")).toHaveCount(0)
    })
})

test.describe("Legend", () => {
    test("hiding series labels writes hideSeriesLabels", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(lineChart(indicators.lifeExpectancy))
        )
        await editor.openTab("Customize")
        const toggle = editor.checkbox("Hide series labels")
        await expect(toggle).not.toBeChecked()

        await toggle.check()

        expect(await editor.saveChanges()).toEqual({ hideSeriesLabels: true })
    })

    test("unticking hide series labels removes hideSeriesLabels", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...stackedAreaChart(
                    indicators.coalEmissions,
                    indicators.oilEmissions
                ),
                hideSeriesLabels: true,
            })
        )
        await editor.openTab("Customize")
        const toggle = editor.checkbox("Hide series labels")
        await expect(toggle).toBeChecked()

        await toggle.uncheck()

        expect(await editor.saveChanges()).toEqual({
            hideSeriesLabels: undefined,
        })
    })

    test("renaming the split-by-metric option writes facettingLabelByYVariables", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(
                lineChart(indicators.lifeExpectancy, indicators.childMortality)
            )
        )
        await editor.openTab("Customize")
        const field = editor.field("Split by metric")
        await expect(field).toHaveValue("metric")

        await editor.fill(field, "indicator")

        expect(await editor.saveChanges()).toEqual({
            facettingLabelByYVariables: "indicator",
        })
    })

    test("the split-by-metric option only shows for charts with several indicators", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(lineChart(indicators.lifeExpectancy))
        )
        await editor.openTab("Customize")

        await expect(editor.checkbox("Hide series labels")).toBeVisible()
        await expect(editor.field("Split by metric")).toHaveCount(0)
    })
})

test.describe("Controls and display", () => {
    test("showing the relative toggle writes hideRelativeToggle false", async ({
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
        const toggle = editor.checkbox("Hide relative toggle")
        await expect(toggle).toBeChecked()

        await toggle.uncheck()

        expect(await editor.saveChanges()).toEqual({
            hideRelativeToggle: false,
        })
    })

    test("hiding the relative toggle again removes hideRelativeToggle", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                hideRelativeToggle: false,
            })
        )
        await editor.openTab("Customize")
        const toggle = editor.checkbox("Hide relative toggle")
        await expect(toggle).not.toBeChecked()

        await toggle.check()

        expect(await editor.saveChanges()).toEqual({
            hideRelativeToggle: undefined,
        })
    })

    test("hiding the total value label of a stacked discrete bar chart writes hideTotalValueLabel", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(
                stackedDiscreteBarChart(
                    indicators.coalEmissions,
                    indicators.oilEmissions
                )
            )
        )
        await editor.openTab("Customize")
        const toggle = editor.checkbox("Hide total value label")
        await expect(toggle).not.toBeChecked()

        await toggle.check()

        expect(await editor.saveChanges()).toEqual({
            hideTotalValueLabel: true,
        })
    })

    test("discrete bar charts have no relative toggle or total value label", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(discreteBarChart(indicators.lifeExpectancy))
        )
        await editor.openTab("Customize")

        await expect(editor.section("Sort Order")).toBeVisible()
        await expect(editor.section("Controls")).toHaveCount(0)
        await expect(editor.section("Display")).toHaveCount(0)
    })
})

test.describe("Comparison lines", () => {
    /** The editor block of the n-th comparison line (1-based) */
    const comparisonLine = (editor: ChartEditorPage, n: number): Locator =>
        editor
            .section("Comparison line")
            .locator(".comparisonLine")
            .nth(n - 1)

    /** The first input row of a comparison line: its type and its value */
    const typeSelect = (line: Locator): Locator =>
        line.locator(".FieldsRow select")
    const valueInput = (line: Locator): Locator =>
        line.locator(".FieldsRow input")

    test("adding a comparison line writes a y = x line", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(await seedChart(scatter))
        await editor.openTab("Customize")

        await editor.button(/Add comparison line/).click()

        const line = comparisonLine(editor, 1)
        await expect(typeSelect(line)).toHaveValue("yEquals")
        await expect(valueInput(line)).toHaveValue("x")
        expect(await editor.saveChanges()).toEqual({
            comparisonLines: [{ yEquals: "x" }],
        })
    })

    test("editing a custom line's formula and label writes them", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...scatter,
                comparisonLines: [{ yEquals: "x" }],
            })
        )
        await editor.openTab("Customize")
        const line = comparisonLine(editor, 1)

        await editor.fill(valueInput(line), "2*x")
        await editor.fill(editor.field("Label", line), "Double")

        expect(await editor.saveChanges()).toEqual({
            comparisonLines: [{ yEquals: "2*x", label: "Double" }],
        })
    })

    test("switching a line to vertical writes xEquals 0", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                comparisonLines: [{ yEquals: "x", label: "Parity" }],
            })
        )
        await editor.openTab("Customize")
        const line = comparisonLine(editor, 1)

        await typeSelect(line).selectOption("x")

        await expect(valueInput(line)).toHaveValue("0")
        expect(await editor.saveChanges()).toEqual({
            comparisonLines: [{ xEquals: 0, label: "Parity" }],
        })
    })

    test("typing a vertical line's position writes xEquals", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...lineChart(indicators.lifeExpectancy),
                comparisonLines: [{ xEquals: 0 }],
            })
        )
        await editor.openTab("Customize")
        const line = comparisonLine(editor, 1)
        await expect(typeSelect(line)).toHaveValue("xEquals")

        await editor.fill(valueInput(line), "2010")

        expect(await editor.saveChanges()).toEqual({
            comparisonLines: [{ xEquals: 2010 }],
        })
    })

    test("removing one of two lines keeps the other", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...scatter,
                comparisonLines: [
                    { yEquals: "x", label: "First" },
                    { yEquals: "2*x", label: "Second" },
                ],
            })
        )
        await editor.openTab("Customize")

        await comparisonLine(editor, 1).getByRole("button").click()

        await expect(
            editor.section("Comparison line").locator(".comparisonLine")
        ).toHaveCount(1)
        expect(await editor.saveChanges()).toEqual({
            comparisonLines: [{ yEquals: "2*x", label: "Second" }],
        })
    })

    test("removing the last line removes comparisonLines", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({ ...scatter, comparisonLines: [{ yEquals: "x" }] })
        )
        await editor.openTab("Customize")

        await comparisonLine(editor, 1).getByRole("button").click()

        expect(await editor.saveChanges()).toEqual({
            comparisonLines: undefined,
        })
    })

    test("marimekko charts only offer custom (y = f(x)) lines", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...marimekkoChart({
                    x: indicators.population,
                    y: indicators.gdpPerCapita,
                }),
                comparisonLines: [{ yEquals: "x" }],
            })
        )
        await editor.openTab("Customize")

        await expect(
            typeSelect(comparisonLine(editor, 1)).locator("option")
        ).toHaveText(["y"])
    })

    test("discrete bar charts have no comparison lines", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(discreteBarChart(indicators.lifeExpectancy))
        )
        await editor.openTab("Customize")

        await expect(editor.section("Sort Order")).toBeVisible()
        await expect(editor.section("Comparison line")).toHaveCount(0)
    })
})

test.describe("Dumbbell", () => {
    /** The color box of a trend ("Increase" or "Decrease") */
    const trendColorBox = (editor: ChartEditorPage, trend: string): Locator =>
        editor
            .section("Dumbbell")
            .locator(".dumbbell-trend-colors .ColorBox")
            .nth(trend === "Increase" ? 0 : 1)

    test("choosing value labels writes dumbbell.valueLabelMode", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(dumbbellChart(indicators.lifeExpectancy))
        )
        await editor.openTab("Customize")
        const select = editor.field("Value labels")
        await expect(select).toHaveValue("absolute")

        await select.selectOption("Percent change")

        expect(await editor.saveChanges()).toEqual({
            "dumbbell.valueLabelMode": "percentChange",
        })
    })

    test("choosing the line connector for several indicators writes dumbbell.connectorStyle", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(
                dumbbellChart(
                    indicators.lifeExpectancy,
                    indicators.childMortality
                )
            )
        )
        await editor.openTab("Customize")
        const select = editor.field("Connector style")
        await expect(select).toHaveValue("arrow")

        await select.selectOption("Line")

        expect(await editor.saveChanges()).toEqual({
            "dumbbell.connectorStyle": "line",
        })
    })

    test("a single-indicator dumbbell has trend colors but no connector style", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(dumbbellChart(indicators.lifeExpectancy))
        )
        await editor.openTab("Customize")
        const dumbbell = editor.section("Dumbbell")

        await expect(dumbbell.locator(".ColorBox")).toHaveCount(2)
        await expect(editor.field("Connector style")).toHaveCount(0)
    })

    test("picking an increase color writes dumbbell.trendColorMap.increase", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(dumbbellChart(indicators.lifeExpectancy))
        )
        await editor.openTab("Customize")

        await editor.pickColor(trendColorBox(editor, "Increase"), "#123456")

        expect(await editor.saveChanges()).toEqual({
            "dumbbell.trendColorMap.increase": "#123456",
        })
    })

    test("inverting the trend colors swaps the defaults", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart(dumbbellChart(indicators.lifeExpectancy))
        )
        await editor.openTab("Customize")

        await editor.button(/Invert colors/, editor.section("Dumbbell")).click()

        expect(await editor.saveChanges()).toEqual({
            "dumbbell.trendColorMap.increase": "#d73c50",
            "dumbbell.trendColorMap.decrease": "#00875e",
        })
    })

    test("inverting custom trend colors swaps them", async ({
        seedChart,
        openEditor,
    }) => {
        const editor = await openEditor(
            await seedChart({
                ...dumbbellChart(indicators.lifeExpectancy),
                dumbbell: { trendColorMap: { increase: "#111111" } },
            })
        )
        await editor.openTab("Customize")

        await editor.button(/Invert colors/, editor.section("Dumbbell")).click()

        expect(await editor.saveChanges()).toEqual({
            "dumbbell.trendColorMap.increase": "#d73c50",
            "dumbbell.trendColorMap.decrease": "#111111",
        })
    })
})
