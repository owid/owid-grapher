import { expect, it, describe } from "vitest"

import * as _ from "lodash-es"
import { Bounds } from "@ourworldindata/utils"
import { FacetChart } from "./FacetChart"
import { SynthesizeGDPTable, OwidTable } from "@ourworldindata/core-table"
import { FacetChartManager, FacetChartProps } from "./FacetChartConstants"
import {
    GRAPHER_CHART_TYPES,
    FacetAxisDomain,
    FacetStrategy,
} from "@ourworldindata/types"
import { LineChart } from "../lineCharts/LineChart"
import { numericDefs, yearDef } from "../testData/columnDefs.js"

const allElementsAreEqual = (array: any[]): boolean => {
    return _.uniq(array).length === 1
}

function makeFacetChart(
    table: OwidTable,
    config: Partial<FacetChartManager> = {},
    props: Partial<Omit<FacetChartProps, "manager">> = {}
): { manager: FacetChartManager; chart: FacetChart } {
    const manager: FacetChartManager = {
        table,
        selection: table.availableEntityNames,
        ...config,
    }
    const chart = new FacetChart({ manager, ...props })
    return { manager, chart }
}

it("can create a new FacetChart", () => {
    const table = SynthesizeGDPTable({ timeRange: [2000, 2010] })
    const { manager, chart } = makeFacetChart(table)

    // default to country facets
    expect(chart.series.length).toEqual(2)

    // switch to metric facets
    manager.facetStrategy = FacetStrategy.metric
    expect(chart.series.length).toEqual(3)
})

it("uses the transformed data for display in country mode", () => {
    const table = SynthesizeGDPTable({ timeRange: [2000, 2010] })
    const { chart } = makeFacetChart(table, {
        // simulate the transformation that is done by Grapher on the data
        transformedTable: table.filterByTimeRange(2002, 2008),
        facetStrategy: FacetStrategy.entity,
    })

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
    const { chart } = makeFacetChart(
        table,
        {
            facetStrategy: FacetStrategy.entity,
            yAxisConfig: { facetDomain: FacetAxisDomain.shared },
        },
        { chartTypeName: GRAPHER_CHART_TYPES.LineChart }
    )
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
            yAxisConfigs.every(
                (config) =>
                    config?.tickFormattingOptions?.numberAbbreviation ===
                    "short"
            )
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
})

describe("shared x axis", () => {
    const table = SynthesizeGDPTable({
        timeRange: [2000, 2010],
        entityCount: 12,
    })
    const { chart } = makeFacetChart(
        table,
        {
            facetStrategy: FacetStrategy.entity,
            yAxisConfig: { facetDomain: FacetAxisDomain.shared },
        },
        {
            chartTypeName: GRAPHER_CHART_TYPES.StackedBar,
            bounds: new Bounds(0, 0, 400, 300),
        }
    )
    const xAxisConfigs = chart.placedSeries.map(
        (series) => series.manager.xAxisConfig
    )

    it("some x axes are hidden", () => {
        expect(
            xAxisConfigs.some((config) => config?.hideAxis === true)
        ).toBeTruthy()
    })

    it("bottom-row facets have taller bounds than inner facets", () => {
        const first = chart.placedSeries[0]
        const last = chart.placedSeries[chart.placedSeries.length - 1]
        expect(last.bounds.height).toBeGreaterThan(first.bounds.height)
    })
})

describe("config overrides", () => {
    const table = SynthesizeGDPTable({
        timeRange: [2000, 2010],
        entityCount: 6,
    })
    const config: Partial<FacetChartManager> = {
        facetStrategy: FacetStrategy.entity,
        yAxisConfig: {
            tickFormattingOptions: { numberAbbreviation: "long" },
            facetDomain: FacetAxisDomain.shared,
            min: -1e15,
            max: 1e15,
        },
    }
    const { chart } = makeFacetChart(table, config, {
        chartTypeName: GRAPHER_CHART_TYPES.LineChart,
    })

    it("preserves config passed from manager", () => {
        const yAxisConfig = chart.placedSeries[0].manager.yAxisConfig
        expect(yAxisConfig?.tickFormattingOptions?.numberAbbreviation).toEqual(
            "long"
        )
        expect(yAxisConfig?.min).toEqual(-1e15)
        expect(yAxisConfig?.max).toEqual(1e15)
    })

    it("preserves axis nice parameter for independent axes", () => {
        const { chart } = makeFacetChart(
            table,
            {
                ...config,
                yAxisConfig: {
                    facetDomain: FacetAxisDomain.independent,
                    nice: true,
                },
            },
            { chartTypeName: GRAPHER_CHART_TYPES.LineChart }
        )
        expect(chart.placedSeries[0].manager.yAxisConfig?.nice).toEqual(true)
    })

    it("entity legend is hidden for single-metric facets by entity", () => {
        expect(chart.placedSeries[0].manager.showLegend).toEqual(false)
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
        // The order of rows is important here! see the explanation above.
        const table = new OwidTable(
            [
                ["gdp", "co2", "year", "entityName"],
                [1, null, 2000, "germany"],
                [2, 1, 2000, "france"],
                [3, 2, 2001, "france"],
                [4, 3, 2001, "germany"],
            ],
            [...numericDefs("gdp", "co2"), yearDef()]
        )

        const { chart } = makeFacetChart(
            table,
            { facetStrategy: FacetStrategy.metric },
            { chartTypeName: GRAPHER_CHART_TYPES.LineChart }
        )

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
