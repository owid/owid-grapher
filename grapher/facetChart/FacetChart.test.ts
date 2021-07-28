#! /usr/bin/env jest

import { FacetChart } from "./FacetChart"
import { SynthesizeGDPTable } from "../../coreTable/OwidTableSynthesizers"
import { ChartManager } from "../chart/ChartManager"
import {
    ChartTypeName,
    FacetAxisRange,
    FacetStrategy,
} from "../core/GrapherConstants"
import { uniq } from "../../clientUtils/Util"

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

    // switch to column facets
    manager.facetStrategy = FacetStrategy.column
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
            facetAxisRange: FacetAxisRange.shared,
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

    it("x axis is shared by default", () => {
        expect(xAxisConfigs[0]?.min).toBeDefined()
        expect(xAxisConfigs[0]?.max).toBeDefined()
        expect(
            allElementsAreEqual(xAxisConfigs.map((config) => config?.min))
        ).toBeTruthy()
        expect(
            allElementsAreEqual(xAxisConfigs.map((config) => config?.max))
        ).toBeTruthy()
    })

    it("shared bottom axis is shown in first row of facets", () => {
        const first = chart.placedSeries[0]
        const last = chart.placedSeries[xAxisConfigs.length - 1]
        expect(first.bounds.height).toBeGreaterThan(last.bounds.height)
        expect(first.bounds.height).toBeCloseTo(
            last.bounds.height + (xAxisConfigs[0]?.minSize ?? 0),
            0
        )
    })
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
            facetAxisRange: FacetAxisRange.shared,
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
                facetAxisRange: FacetAxisRange.independent,
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
