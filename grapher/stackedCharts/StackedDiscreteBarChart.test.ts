#! /usr/bin/env jest

import { SortOrder, SortBy } from "../../clientUtils/owidTypes"
import { ColumnTypeNames } from "../../coreTable/CoreColumnDef"
import { OwidTable } from "../../coreTable/OwidTable"
import {
    SampleColumnSlugs,
    SynthesizeFruitTable,
} from "../../coreTable/OwidTableSynthesizers"
import { ChartManager } from "../chart/ChartManager"
import { SelectionArray } from "../selection/SelectionArray"
import { StackedDiscreteBarChart } from "./StackedDiscreteBarChart"

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

    const chart = new StackedDiscreteBarChart({ manager })
    expect(chart.failMessage).toBeTruthy()

    selection.addToSelection(table.sampleEntityName(5))
    expect(chart.failMessage).toEqual("")
    expect(chart.series.length).toEqual(2)
    expect(chart.series[0].points.length).toEqual(5)
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
    const chart = new StackedDiscreteBarChart({ manager })

    // Check that our absolute values get properly transformed into percentages
    expect(chart.failMessage).toEqual("")
    expect(chart.series.length).toEqual(2)
    expect(chart.series[0].points).toEqual([
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
    expect(chart.series[1].points).toEqual([
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
    const chart = new StackedDiscreteBarChart({ manager })

    // Check that our absolute values get properly transformed into percentages
    expect(chart.failMessage).toEqual("")
    expect(chart.series.length).toEqual(2)
    expect(chart.series[0].points).toEqual([
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
    expect(chart.series[1].points).toEqual([
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

describe("columns as series", () => {
    const table = SynthesizeFruitTable({
        timeRange: [2000, 2001],
        entityCount: 5,
    })
    const manager: ChartManager = {
        table,
        selection: table.sampleEntityName(5),
        yColumnSlugs: [SampleColumnSlugs.Fruit, SampleColumnSlugs.Vegetables],
    }
    const chart = new StackedDiscreteBarChart({ manager })

    it("renders the legend items in the order of yColumns", () => {
        expect(chart.categoricalLegendData.length).toEqual(2)
        expect(chart.categoricalLegendData.map((bin) => bin.value)).toEqual([
            SampleColumnSlugs.Fruit,
            SampleColumnSlugs.Vegetables,
        ])
    })

    it("render the stacked bars in order of yColumns", () => {
        expect(chart.series.length).toEqual(2)
        expect(chart.series.map((series) => series.seriesName)).toEqual([
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
        const chart = new StackedDiscreteBarChart({ manager: baseManager })
        expect(chart.sortedItems.map((item) => item.label)).toEqual([
            "Spain",
            "France",
            "Germany",
        ])
    })

    it("can sort by entity name", () => {
        const chart = new StackedDiscreteBarChart({
            manager: {
                ...baseManager,
                sortConfig: {
                    sortBy: SortBy.entityName,
                    sortOrder: SortOrder.asc,
                },
            },
        })

        expect(chart.sortedItems.map((item) => item.label)).toEqual([
            "France",
            "Germany",
            "Spain",
        ])
    })

    it("can sort by total descending", () => {
        const chart = new StackedDiscreteBarChart({
            manager: {
                ...baseManager,
                sortConfig: {
                    sortBy: SortBy.total,
                    sortOrder: SortOrder.desc,
                },
            },
        })

        expect(chart.sortedItems.map((item) => item.label)).toEqual([
            "Spain",
            "France",
            "Germany",
        ])
    })

    it("can sort by single dimension", () => {
        const chart = new StackedDiscreteBarChart({
            manager: {
                ...baseManager,
                sortConfig: {
                    sortBy: SortBy.column,
                    sortColumnSlug: "coal",
                    sortOrder: SortOrder.desc,
                },
            },
        })

        expect(chart.sortedItems.map((item) => item.label)).toEqual([
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

        const chart = new StackedDiscreteBarChart({
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
        expect(chart.sortedItems.map((item) => item.label)).toEqual([
            "Belgium",
            "Germany",
            "Spain",
            "France",
        ])
    })
})

describe("hideLegend", () => {
    const table = SynthesizeFruitTable({
        timeRange: [2000, 2001],
        entityCount: 5,
    })
    const baseManager: ChartManager = {
        table,
        selection: table.sampleEntityName(5),
        yColumnSlugs: [SampleColumnSlugs.Fruit, SampleColumnSlugs.Vegetables],
    }

    it("renders internal legend when hideLegend is true", () => {
        const chart = new StackedDiscreteBarChart({
            manager: { ...baseManager },
        })
        expect(chart["legend"].height).toBeGreaterThan(0)
        expect(chart["categoricalLegendData"].length).toBeGreaterThan(0)
        expect(chart["externalLegendBins"].length).toEqual(0)
    })

    it("exposes externalLegendBins when hideLegend is false", () => {
        const chart = new StackedDiscreteBarChart({
            manager: { ...baseManager, hideLegend: true },
        })
        expect(chart["legend"].height).toEqual(0)
        expect(chart["categoricalLegendData"].length).toEqual(0)
        expect(chart["externalLegendBins"].length).toEqual(2)
    })
})
