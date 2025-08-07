import { expect, it, describe } from "vitest"

import {
    SortOrder,
    SortBy,
    ColumnTypeNames,
    MissingDataStrategy,
} from "@ourworldindata/utils"
import {
    OwidTable,
    SampleColumnSlugs,
    SynthesizeFruitTable,
} from "@ourworldindata/core-table"
import { ChartManager } from "../chart/ChartManager"
import { SelectionArray } from "../selection/SelectionArray"
import { StackedDiscreteBarChart } from "./StackedDiscreteBarChart"
import { StackedDiscreteBarChartState } from "./StackedDiscreteBarChartState"

it("can create a chart", () => {
    const table = SynthesizeFruitTable({
        timeRange: [2000, 2001],
        entityCount: 5,
    })
    const selection = new SelectionArray()
    const manager = {
        table,
        yColumnSlugs: [SampleColumnSlugs.Fruit, SampleColumnSlugs.Vegetables],
        selection,
    }

    const chartState = new StackedDiscreteBarChartState({ manager })
    expect(chartState.errorInfo.reason).toBeTruthy()

    selection.addToSelection(table.sampleEntityName(5))
    expect(chartState.errorInfo.reason).toEqual("")
    expect(chartState.series.length).toEqual(2)
    expect(chartState.series[0].points.length).toEqual(5)
})

it("can display a StackedDiscreteBar chart in relative mode", () => {
    const csv = `coal,gas,year,entityName
    20,30,2000,France
    6,14,2000,Spain`
    const table = new OwidTable(csv, [
        { slug: "coal", type: ColumnTypeNames.Numeric },
        { slug: "gas", type: ColumnTypeNames.Numeric },
        { slug: "year", type: ColumnTypeNames.Year },
    ])

    const manager: ChartManager = {
        table,
        selection: table.availableEntityNames,
        yColumnSlugs: ["coal", "gas"],
        isRelativeMode: true,
    }
    const chartState = new StackedDiscreteBarChartState({ manager })

    // Check that our absolute values get properly transformed into percentages
    expect(chartState.errorInfo.reason).toEqual("")
    expect(chartState.series.length).toEqual(2)
    expect(chartState.series[0].points).toEqual([
        {
            position: "France",
            value: 40,
            valueOffset: 0,
            time: 2000,
            fake: false,
        },
        {
            position: "Spain",
            value: 30,
            valueOffset: 0,
            time: 2000,
            fake: false,
        },
    ])
    expect(chartState.series[1].points).toEqual([
        {
            position: "France",
            value: 60,
            valueOffset: 40,
            time: 2000,
            fake: false,
        },
        {
            position: "Spain",
            value: 70,
            valueOffset: 30,
            time: 2000,
            fake: false,
        },
    ])
})

it("can display a chart with missing variable data for some entities", () => {
    const csv = `coal,gas,year,entityName
    20,,2000,France
    ,14,2000,Spain`
    const table = new OwidTable(csv, [
        { slug: "coal", type: ColumnTypeNames.Numeric },
        { slug: "gas", type: ColumnTypeNames.Numeric },
        { slug: "year", type: ColumnTypeNames.Year },
    ])

    const manager: ChartManager = {
        table,
        selection: table.availableEntityNames,
        yColumnSlugs: ["coal", "gas"],
    }
    const chartState = new StackedDiscreteBarChartState({ manager })

    // Check that our absolute values get properly transformed into percentages
    expect(chartState.errorInfo.reason).toEqual("")
    expect(
        chartState.transformTableForSelection(table).availableEntityNames
    ).toEqual(["France", "Spain"])

    expect(chartState.series.length).toEqual(2)
    expect(chartState.series[0].points).toEqual([
        {
            position: "France",
            value: 20,
            valueOffset: 0,
            time: 2000,
            fake: false,
        },
        {
            position: "Spain",
            value: 0,
            valueOffset: 0,
            time: 0,
            fake: true,
        },
    ])
    expect(chartState.series[1].points).toEqual([
        {
            position: "France",
            value: 0,
            valueOffset: 20,
            time: 0,
            fake: true,
        },
        {
            position: "Spain",
            value: 14,
            valueOffset: 0,
            time: 2000,
            fake: false,
        },
    ])
})

it("can display a chart with missing variable data for some entities, while hiding missing data", () => {
    const csv = `coal,gas,year,entityName
    20,,2000,France
    10,20,2000,Italy
    ,14,2000,Spain`
    const table = new OwidTable(csv, [
        { slug: "coal", type: ColumnTypeNames.Numeric },
        { slug: "gas", type: ColumnTypeNames.Numeric },
        { slug: "year", type: ColumnTypeNames.Year },
    ])

    const manager: ChartManager = {
        table,
        selection: table.availableEntityNames,
        yColumnSlugs: ["coal", "gas"],
        missingDataStrategy: MissingDataStrategy.hide,
    }
    const chartState = new StackedDiscreteBarChartState({ manager })

    // Check that our absolute values get properly transformed into percentages
    expect(chartState.errorInfo.reason).toEqual("")
    expect(
        chartState.transformTableForSelection(table).availableEntityNames
    ).toEqual(["Italy"])

    expect(chartState.series.length).toEqual(2)
    expect(chartState.series[0].points).toEqual([
        {
            position: "Italy",
            value: 10,
            valueOffset: 0,
            time: 2000,
            fake: false,
        },
    ])
    expect(chartState.series[1].points).toEqual([
        {
            position: "Italy",
            value: 20,
            valueOffset: 10,
            time: 2000,
            fake: false,
        },
    ])
})

it("can display a chart with missing variable data for some entities, while hiding missing data in relative mode", () => {
    const csv = `coal,gas,year,entityName
    20,,2000,France
    10,30,2000,Italy
    ,14,2000,Spain`
    const table = new OwidTable(csv, [
        { slug: "coal", type: ColumnTypeNames.Numeric },
        { slug: "gas", type: ColumnTypeNames.Numeric },
        { slug: "year", type: ColumnTypeNames.Year },
    ])

    const manager: ChartManager = {
        table,
        selection: table.availableEntityNames,
        yColumnSlugs: ["coal", "gas"],
        isRelativeMode: true,
    }
    const chartState = new StackedDiscreteBarChartState({ manager })

    // Check that our absolute values get properly transformed into percentages
    expect(chartState.errorInfo.reason).toEqual("")
    expect(
        chartState.transformTableForSelection(table).availableEntityNames
    ).toEqual(["Italy"])

    expect(chartState.series.length).toEqual(2)
    expect(chartState.series[0].points).toEqual([
        {
            position: "Italy",
            value: 25,
            valueOffset: 0,
            time: 2000,
            fake: false,
        },
    ])
    expect(chartState.series[1].points).toEqual([
        {
            position: "Italy",
            value: 75,
            valueOffset: 25,
            time: 2000,
            fake: false,
        },
    ])
})

it("can display chart with negative values", () => {
    const csv = `coal,gas,year,entityName
-20,30,2000,France
40,10,2000,Spain`
    const table = new OwidTable(csv, [
        { slug: "coal", type: ColumnTypeNames.Numeric },
        { slug: "gas", type: ColumnTypeNames.Numeric },
        { slug: "year", type: ColumnTypeNames.Year },
    ])

    const manager: ChartManager = {
        table,
        selection: table.availableEntityNames,
        yColumnSlugs: ["coal", "gas"],
    }
    const chartState = new StackedDiscreteBarChartState({ manager })

    expect(chartState.errorInfo.reason).toEqual("")
    expect(chartState.series.length).toEqual(2)

    expect(chartState.series[0].points).toEqual([
        {
            position: "France",
            value: -20,
            valueOffset: 0,
            time: 2000,
            fake: false,
        },
        {
            position: "Spain",
            value: 40,
            valueOffset: 0,
            time: 2000,
            fake: false,
        },
    ])

    expect(chartState.series[1].points).toEqual([
        {
            position: "France",
            value: 30,
            // offset is 0 because the previous series has a negative value
            valueOffset: 0,
            time: 2000,
            fake: false,
        },
        {
            position: "Spain",
            value: 10,
            valueOffset: 40,
            time: 2000,
            fake: false,
        },
    ])
})

describe("columns as series", () => {
    const table = SynthesizeFruitTable({
        timeRange: [2000, 2001],
        entityCount: 5,
    })
    const manager: ChartManager = {
        table,
        selection: table.sampleEntityName(5),
        yColumnSlugs: [SampleColumnSlugs.Fruit, SampleColumnSlugs.Vegetables],
        showLegend: true,
    }
    const chartState = new StackedDiscreteBarChartState({ manager })
    const chart = new StackedDiscreteBarChart({ chartState })

    it("renders the legend items in the order of yColumns", () => {
        expect(chart.categoricalLegendData.length).toEqual(2)
        expect(chart.categoricalLegendData.map((bin) => bin.value)).toEqual([
            SampleColumnSlugs.Fruit,
            SampleColumnSlugs.Vegetables,
        ])
    })

    it("render the stacked bars in order of yColumns", () => {
        expect(chartState.series.length).toEqual(2)
        expect(chartState.series.map((series) => series.seriesName)).toEqual([
            SampleColumnSlugs.Fruit,
            SampleColumnSlugs.Vegetables,
        ])
    })
})

describe("sorting", () => {
    const csv = `coal,gas,year,entityName
    10,20,2000,France
    35,2,2000,Spain
    11,8,2000,Germany`
    const columnDef = [
        { slug: "coal", type: ColumnTypeNames.Numeric },
        { slug: "gas", type: ColumnTypeNames.Numeric },
        { slug: "year", type: ColumnTypeNames.Year },
    ]
    const table = new OwidTable(csv, columnDef)

    const baseManager: ChartManager = {
        table,
        selection: table.availableEntityNames,
        yColumnSlugs: ["coal", "gas"],
    }

    it("defaults to sorting by total value descending", () => {
        const chartState = new StackedDiscreteBarChartState({
            manager: baseManager,
        })
        expect(chartState.sortedItems.map((item) => item.entityName)).toEqual([
            "Spain",
            "France",
            "Germany",
        ])
    })

    it("can sort by entity name", () => {
        const chartState = new StackedDiscreteBarChartState({
            manager: {
                ...baseManager,
                sortConfig: {
                    sortBy: SortBy.entityName,
                    sortOrder: SortOrder.asc,
                },
            },
        })

        expect(chartState.sortedItems.map((item) => item.entityName)).toEqual([
            "France",
            "Germany",
            "Spain",
        ])
    })

    it("can sort by total descending", () => {
        const chartState = new StackedDiscreteBarChartState({
            manager: {
                ...baseManager,
                sortConfig: {
                    sortBy: SortBy.total,
                    sortOrder: SortOrder.desc,
                },
            },
        })

        expect(chartState.sortedItems.map((item) => item.entityName)).toEqual([
            "Spain",
            "France",
            "Germany",
        ])
    })

    it("can sort by total descending", () => {
        const chartState = new StackedDiscreteBarChartState({
            manager: {
                ...baseManager,
                sortConfig: {
                    sortBy: SortBy.total,
                    sortOrder: SortOrder.desc,
                },
            },
        })

        expect(chartState.sortedItems.map((item) => item.entityName)).toEqual([
            "Spain",
            "France",
            "Germany",
        ])
    })

    it("can use custom sort order", () => {
        const selection = ["France", "Spain", "Germany"]
        const chartState = new StackedDiscreteBarChartState({
            manager: {
                ...baseManager,
                sortConfig: {
                    sortBy: SortBy.custom,
                    sortOrder: SortOrder.asc,
                },
                selection,
            },
        })

        expect(chartState.sortedItems.map((item) => item.entityName)).toEqual(
            selection
        )
    })

    it("can sort by single dimension", () => {
        const chartState = new StackedDiscreteBarChartState({
            manager: {
                ...baseManager,
                sortConfig: {
                    sortBy: SortBy.column,
                    sortColumnSlug: "coal",
                    sortOrder: SortOrder.desc,
                },
            },
        })

        expect(chartState.sortedItems.map((item) => item.entityName)).toEqual([
            "Spain",
            "Germany",
            "France",
        ])
    })

    it("can sort by column that's missing values", () => {
        const csv = `coal,gas,year,entityName
    ,20,2000,France
    ,2,2000,Spain
    9,8,2000,Germany
    11,,2000,Belgium`
        const table = new OwidTable(csv, columnDef)

        const chartState = new StackedDiscreteBarChartState({
            manager: {
                ...baseManager,
                table,
                selection: table.availableEntityNames,
                sortConfig: {
                    sortBy: SortBy.column,
                    sortColumnSlug: "coal",
                    sortOrder: SortOrder.desc,
                },
            },
        })

        // Expected behavior: Belgium and Germany are sorted first because they have values.
        expect(chartState.sortedItems.map((item) => item.entityName)).toEqual([
            "Belgium",
            "Germany",
            "Spain",
            "France",
        ])
    })
})

describe("showLegend", () => {
    const table = SynthesizeFruitTable({
        timeRange: [2000, 2001],
        entityCount: 5,
    })
    const baseManager: ChartManager = {
        table,
        selection: table.sampleEntityName(5),
        yColumnSlugs: [SampleColumnSlugs.Fruit, SampleColumnSlugs.Vegetables],
    }

    it("renders internal legend when showLegend is true", () => {
        const chartState = new StackedDiscreteBarChartState({
            manager: { ...baseManager, showLegend: true },
        })
        const chart = new StackedDiscreteBarChart({ chartState })
        expect(chart["legend"].height).toBeGreaterThan(0)
        expect(chart["categoricalLegendData"].length).toBeGreaterThan(0)
        expect(chart["externalLegend"]).toBeUndefined()
    })

    it("exposes externalLegendBins when showLegend is false", () => {
        const chartState = new StackedDiscreteBarChartState({
            manager: { ...baseManager, showLegend: false },
        })
        const chart = new StackedDiscreteBarChart({ chartState })
        expect(chart["legend"].height).toEqual(0)
        expect(chart["categoricalLegendData"].length).toEqual(0)
        expect(chart["externalLegend"]?.categoricalLegendData?.length).toEqual(
            2
        )
    })
})
