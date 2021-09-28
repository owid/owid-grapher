#! /usr/bin/env jest

import { FacetChart } from "./FacetChart"
import { SynthesizeGDPTable } from "../../coreTable/OwidTableSynthesizers"
import { ChartManager } from "../chart/ChartManager"
import {
    ChartTypeName,
    FacetAxisDomain,
    FacetStrategy,
} from "../core/GrapherConstants"
import { uniq } from "../../clientUtils/Util"
import { OwidTable } from "../../coreTable/OwidTable"
import { ColumnTypeNames } from "../../coreTable/CoreColumnDef"
import { LineChart } from "../lineCharts/LineChart"

const allElementsAreEqual = (array: any[]): boolean => {
    return uniq(array).length === 1
}

it("can create a new FacetChart", () => {
    const table = SynthesizeGDPTable({ timeRange: [2000, 2010] })
    const manager: ChartManager = {
        table,
        selection: table.availableEntityNames,
    }
    const chart = new FacetChart({ manager })

    // default to country facets
    expect(chart.series.length).toEqual(2)

    // switch to metric facets
    manager.facetStrategy = FacetStrategy.metric
    expect(chart.series.length).toEqual(3)
})

it("uses the transformed data for display in country mode", () => {
    const table = SynthesizeGDPTable({ timeRange: [2000, 2010] })
    const manager: ChartManager = {
        table,
        selection: table.availableEntityNames,
        // simulate the transformation that is done by Grapher on the data
        transformedTable: table.filterByTimeRange(2002, 2008),
        facetStrategy: FacetStrategy.entity,
    }
    const chart = new FacetChart({ manager })

    // we should be using the transformed table
    chart.series.forEach((s) => {
        expect(s.manager.table!.minTime).toEqual(2002)
        expect(s.manager.table!.maxTime).toEqual(2008)
    })
})

describe("uniform axes", () => {
    const table = SynthesizeGDPTable({
        timeRange: [2000, 2010],
        entityCount: 6,
    })
    const manager: ChartManager = {
        table,
        selection: table.availableEntityNames,
        facetStrategy: FacetStrategy.entity,
        yAxisConfig: {
            facetDomain: FacetAxisDomain.shared,
        },
    }
    const chart = new FacetChart({
        manager,
        chartTypeName: ChartTypeName.LineChart,
    })
    const yAxisConfigs = chart.placedSeries.map(
        (series) => series.manager.yAxisConfig
    )
    const xAxisConfigs = chart.placedSeries.map(
        (series) => series.manager.xAxisConfig
    )

    it("creates correct number of facets", () => {
        expect(chart.series.length).toEqual(6)
    })

    it("some y axes are collapsed", () => {
        expect(
            yAxisConfigs.some((config) => config?.hideAxis === true)
        ).toBeTruthy()
    })

    it("y axes have compact labels", () => {
        expect(
            yAxisConfigs.every((config) => config?.compactLabels === true)
        ).toBeTruthy()
    })

    it("y axis domains are identical", () => {
        expect(yAxisConfigs[0]?.min).toBeDefined()
        expect(yAxisConfigs[0]?.max).toBeDefined()
        expect(
            allElementsAreEqual(yAxisConfigs.map((config) => config?.min))
        ).toBeTruthy()
        expect(
            allElementsAreEqual(yAxisConfigs.map((config) => config?.max))
        ).toBeTruthy()
    })

    it("allocates space for shared y axis", () => {
        const minSizes = yAxisConfigs.map((config) => config?.minSize)
        expect(allElementsAreEqual(minSizes)).toBeTruthy()

        const minSize = minSizes[0] ?? 0
        expect(minSize).toBeGreaterThan(0)

        expect(chart.placedSeries[0].bounds.width).toBeGreaterThan(
            chart.placedSeries[1].bounds.width
        )
        expect(chart.placedSeries[0].bounds.width).toBeCloseTo(
            chart.placedSeries[1].bounds.width + minSize,
            0
        )
    })

    it("x axis domains are identical", () => {
        expect(xAxisConfigs[0]?.min).toBeDefined()
        expect(xAxisConfigs[0]?.max).toBeDefined()
        expect(
            allElementsAreEqual(xAxisConfigs.map((config) => config?.min))
        ).toBeTruthy()
        expect(
            allElementsAreEqual(xAxisConfigs.map((config) => config?.max))
        ).toBeTruthy()
    })

    it("x axis is shown on all facets", () => {
        expect(xAxisConfigs.every((config) => !config?.hideAxis)).toBeTruthy()
    })

    // it("shared bottom axis is shown in first row of facets", () => {
    //     const first = chart.placedSeries[0]
    //     const last = chart.placedSeries[xAxisConfigs.length - 1]
    //     expect(first.bounds.height).toBeGreaterThan(last.bounds.height)
    //     expect(first.bounds.height).toBeCloseTo(
    //         last.bounds.height + (xAxisConfigs[0]?.minSize ?? 0),
    //         0
    //     )
    // })
})

describe("config overrides", () => {
    const table = SynthesizeGDPTable({
        timeRange: [2000, 2010],
        entityCount: 6,
    })
    const manager: ChartManager = {
        table,
        selection: table.availableEntityNames,
        facetStrategy: FacetStrategy.entity,
        yAxisConfig: {
            compactLabels: false,
            facetDomain: FacetAxisDomain.shared,
            min: -1e15,
            max: 1e15,
        },
    }
    const chart = new FacetChart({
        manager,
        chartTypeName: ChartTypeName.LineChart,
    })

    it("preserves config passed from manager", () => {
        const yAxisConfig = chart.placedSeries[0].manager.yAxisConfig
        expect(yAxisConfig?.compactLabels).toEqual(false)
        expect(yAxisConfig?.min).toEqual(-1e15)
        expect(yAxisConfig?.max).toEqual(1e15)
    })

    it("preserves axis nice parameter for independent axes", () => {
        const newManager: ChartManager = {
            ...manager,
            yAxisConfig: {
                facetDomain: FacetAxisDomain.independent,
                nice: true,
            },
        }
        const chart = new FacetChart({
            manager: newManager,
            chartTypeName: ChartTypeName.LineChart,
        })
        expect(chart.placedSeries[0].manager.yAxisConfig?.nice).toEqual(true)
    })

    it("entity legend is hidden for single-metric facets by entity", () => {
        expect(chart.placedSeries[0].manager.hideLegend).toEqual(true)
    })
})

describe("global legend", () => {
    /**
     * There was an issue where the global legend showed some color for an entity,
     * but one of the facet charts was actually displaying the same entity in a different color.
     * This occurred when the order of the first non-empty value for an entity in the table is
     * different for different columns:
     * I.e. in the below table, the first entity for the "gdp" column is germany, but for the co2
     * column it is france.
     */

    const getColorMap = (chart: LineChart): Map<string, string> =>
        new Map(chart.series.map((s) => [s.seriesName, s.color]))

    it("consistently assigns entity colors", () => {
        // The order of lines is important here! see the explanation above.
        const csv = `gdp,co2,year,entityName
1,,2000,germany
2,1,2000,france
3,2,2001,france
4,3,2001,germany`
        const table = new OwidTable(csv, [
            { slug: "gdp", type: ColumnTypeNames.Numeric },
            { slug: "co2", type: ColumnTypeNames.Numeric },
            { slug: "year", type: ColumnTypeNames.Year },
            { slug: "entityName", type: ColumnTypeNames.EntityName },
        ])

        const manager: ChartManager = {
            table,
            selection: table.availableEntityNames,
            facetStrategy: FacetStrategy.metric,
        }
        const chart = new FacetChart({
            manager,
            chartTypeName: ChartTypeName.LineChart,
        })

        const legend = chart.categoricalLegendData
        const colors = new Map(legend.map((bin) => [bin.value, bin.color]))

        expect(colors.size).toEqual(2)

        expect(
            getColorMap(chart["intermediateChartInstances"][0] as LineChart)
        ).toEqual(colors)
        expect(
            getColorMap(chart["intermediateChartInstances"][1] as LineChart)
        ).toEqual(colors)
    })
})
