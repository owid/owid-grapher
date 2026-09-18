import * as _ from "lodash-es"
import { expect, it, describe } from "vitest"

import { StackedAreaChart } from "./StackedAreaChart"
import {
    SampleColumnSlugs,
    SynthesizeFruitTable,
    SynthesizeFruitTableWithStringValues,
    SynthesizeGDPTable,
    OwidTable,
    numericDefs,
    yearDef,
} from "@ourworldindata/core-table"

import { makeObservable, observable } from "mobx"
import { AxisConfig } from "../axis/AxisConfig"
import { SelectionArray } from "../selection/SelectionArray"
import { Bounds, GRAPHER_CHART_TYPES } from "@ourworldindata/utils"
import { ColumnTypeNames, FacetStrategy } from "@ourworldindata/types"
import { StackedAreaChartState } from "./StackedAreaChartState.js"
import { ChartManager } from "../chart/ChartManager"
import { FacetChart } from "../facet/FacetChart"

class MockManager implements ChartManager {
    constructor() {
        makeObservable(this, {
            isRelativeMode: observable,
        })
    }

    table = SynthesizeGDPTable({
        timeRange: [1950, 2010],
    })
    yColumnSlugs = [SampleColumnSlugs.GDP]
    yAxisConfig = new AxisConfig({ min: 0, max: 200 })
    isRelativeMode = false
    selection = new SelectionArray()
    activeChartType = GRAPHER_CHART_TYPES.StackedArea
}

it("can create a basic chart", () => {
    const manager = new MockManager()
    const chartState = new StackedAreaChartState({ manager })
    expect(chartState.errorInfo.reason).toBeTruthy()
    manager.selection.addToSelection(manager.table.availableEntityNames)
    expect(chartState.errorInfo.reason).toEqual("")
})

describe("column charts", () => {
    it("can show custom colors for a column series", () => {
        let table = SynthesizeFruitTable()
        table = table.updateDefs((def) => {
            def.color = def.slug // Slug is not a valid color but good enough for testing
            return def
        })
        const columnsChart: ChartManager = {
            table,
            selection: table.sampleEntityName(1),
            yColumnSlugs: [
                SampleColumnSlugs.Fruit,
                SampleColumnSlugs.Vegetables,
            ],
        }
        const chartState = new StackedAreaChartState({ manager: columnsChart })
        expect(chartState.series.map((series) => series.color)).toEqual([
            SampleColumnSlugs.Vegetables,
            SampleColumnSlugs.Fruit,
        ])
    })

    it("assigns valid colors to columns without pre-defined colors", () => {
        const table = SynthesizeFruitTable()
        const columnsChart: ChartManager = {
            table,
            selection: table.sampleEntityName(1),
            yColumnSlugs: [
                SampleColumnSlugs.Fruit,
                SampleColumnSlugs.Vegetables,
            ],
        }
        const chartState = new StackedAreaChartState({ manager: columnsChart })
        const assignedColors = chartState.series.map((series) => series.color)
        expect(assignedColors).toHaveLength(2)
        for (const color of assignedColors)
            expect(color).toMatch(
                /^#[0-9a-f]{6}$|^rgb\(\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i
            ) // valid hex color string or rgb() string
    })
})

it("use author axis settings unless relative mode", () => {
    const manager = new MockManager()
    const chartState = new StackedAreaChartState({ manager })
    const chart = new StackedAreaChart({ chartState })
    expect(chart.yAxis.domain[1]).toBeGreaterThan(100)
    manager.isRelativeMode = true
    expect(chart.yAxis.domain).toEqual([0, 100])
})

it("shows a failure message if there are columns but no series", () => {
    const chartState = new StackedAreaChartState({
        manager: { table: SynthesizeFruitTable() },
    })
    expect(chartState.errorInfo.reason).toBeTruthy()
})

it("can filter a series when there are no points", () => {
    const table = SynthesizeFruitTable({
        entityCount: 2,
        timeRange: [2000, 2003],
    }).replaceRandomCells(6, [SampleColumnSlugs.Fruit], 1)
    const chartState = new StackedAreaChartState({
        manager: {
            selection: table.sampleEntityName(1),
            table,
        },
    })

    expect(chartState.series.length).toEqual(0)
})

it("filters non-numeric values", () => {
    const table = SynthesizeFruitTableWithStringValues(
        {
            entityCount: 2,
            timeRange: [1900, 2000],
        },
        20,
        1
    )
    const manager: ChartManager = {
        table,
        yColumnSlugs: [SampleColumnSlugs.Fruit],
        selection: table.availableEntityNames,
    }
    const chartState = new StackedAreaChartState({ manager })
    expect(chartState.series.length).toEqual(2)
    expect(
        chartState.series.every((series) =>
            series.points.every(
                (point) => _.isNumber(point.position) && _.isNumber(point.value)
            )
        )
    ).toBeTruthy()
})

it("should drop missing values at start or end", () => {
    const table = new OwidTable(
        [
            ["gdp", "year", "entityName"],
            [null, 2000, "france"],
            [null, 2001, "france"],
            [1, 2002, "france"],
            [2, 2003, "france"],
            [8, 2004, "france"],
            [null, 2005, "france"],
            [null, 2000, "uk"],
            [null, 2001, "uk"],
            [5, 2002, "uk"],
            [18, 2003, "uk"],
            [2, 2004, "uk"],
            [null, 2005, "uk"],
        ],
        [...numericDefs("gdp"), yearDef()]
    )
    const manager: ChartManager = {
        table,
        yColumnSlugs: ["gdp"],
        selection: table.availableEntityNames,
    }
    const chartState = new StackedAreaChartState({ manager })
    expect(chartState.series.length).toEqual(2)
    expect(chartState.series[0].points.length).toEqual(3)
    expect(chartState.series[1].points.length).toEqual(3)
})

it("should mark interpolated and missing values", () => {
    const table = new OwidTable(
        [
            ["gdp", "year", "entityName"],
            [10, 2000, "france"],
            [0, 2001, "france"],
            [null, 2002, "france"],
            [null, 2003, "france"],
            [8, 2005, "france"],
            [null, 2006, "france"],
            [2, 2000, "uk"],
            [3, 2004, "uk"],
        ],
        [...numericDefs("gdp"), yearDef()]
    )

    const manager: ChartManager = {
        table,
        yColumnSlugs: ["gdp"],
        selection: table.availableEntityNames,
    }

    const chartState = new StackedAreaChartState({ manager })

    // indices are reversed because stacked charts reverse the stacking order
    const pointsFrance = chartState.series[1].points
    const pointsUK = chartState.series[0].points

    expect(
        pointsFrance.map((p) => [p.position, !!p.interpolated, !!p.missing])
    ).toEqual([
        [2000, false, false],
        [2001, false, false],
        [2004, true, false],
        [2005, false, false],
    ])
    expect(
        pointsUK.map((p) => [p.position, !!p.interpolated, !!p.missing])
    ).toEqual([
        [2000, false, false],
        [2001, true, false],
        [2004, false, false],
        [2005, false, true],
    ])
})

it("marks interpolated values the same way when facetted", () => {
    const table = new OwidTable(
        [
            ["gdp", "coal", "year", "entityName"],
            [10, 1, 2000, "france"],
            [0, 2, 2001, "france"],
            [null, 3, 2002, "france"],
            [null, 4, 2003, "france"],
            [8, 5, 2005, "france"],
            [null, 6, 2006, "france"],
        ],
        [...numericDefs("gdp", "coal"), yearDef()]
    )
    const yColumnSlugs = ["gdp", "coal"]
    const selection = ["france"]

    const unfacetted = new StackedAreaChartState({
        manager: { table, yColumnSlugs, selection },
    })
    const interpolatedByColumn = new Map(
        unfacetted.series.map((series) => [
            series.seriesName,
            series.points.map((point) => !!point.interpolated),
        ])
    )
    expect(interpolatedByColumn.get("gdp")).toEqual([
        false,
        false,
        true,
        true,
        false,
    ])

    // On the facet path Grapher has already run transformTable on this table,
    // and each facet then transforms it again.
    const facetChart = new FacetChart({
        bounds: new Bounds(0, 0, 800, 600),
        chartTypeName: GRAPHER_CHART_TYPES.StackedArea,
        manager: {
            table,
            transformedTable: unfacetted.transformedTable,
            yColumnSlugs,
            selection,
            facetStrategy: FacetStrategy.metric,
        },
    })

    for (const [index, slug] of yColumnSlugs.entries()) {
        const facetState = facetChart.intermediateChartInstances[index]
            .chartState as StackedAreaChartState
        expect(
            facetState.series[0].points.map((point) => !!point.interpolated)
        ).toEqual(interpolatedByColumn.get(slug))
    }
})

describe("externalLegendBins", () => {
    const table = SynthesizeFruitTable({
        timeRange: [2000, 2010],
        entityCount: 1,
    })
    const baseManager: ChartManager = {
        table,
        selection: table.sampleEntityName(1),
        yColumnSlugs: [SampleColumnSlugs.Fruit, SampleColumnSlugs.Vegetables],
    }

    it("doesn't expose externalLegendBins when legend is shown", () => {
        const chartState = new StackedAreaChartState({
            manager: { ...baseManager, showSeriesLabels: true },
        })
        const chart = new StackedAreaChart({ chartState })
        expect(chart.externalLegend).toBeUndefined()
    })

    it("exposes externalLegendBins when legend is hidden", () => {
        const chartState = new StackedAreaChartState({
            manager: { ...baseManager, showSeriesLabels: false },
        })
        const chart = new StackedAreaChart({ chartState })
        expect(chart.externalLegend?.categoricalLegendData?.length).toEqual(2)
    })
})

describe("availableFacetStrategies", () => {
    const makeTable = (fruitUnit: string, vegetableUnit: string): OwidTable =>
        SynthesizeFruitTable({
            timeRange: [2000, 2010],
            entityCount: 3,
        }).updateDefs((def) => {
            if (def.slug === SampleColumnSlugs.Fruit) def.shortUnit = fruitUnit
            if (def.slug === SampleColumnSlugs.Vegetables)
                def.shortUnit = vegetableUnit
            return def
        })

    const makeChartState = (
        table: OwidTable,
        manager: Partial<ChartManager>
    ): StackedAreaChartState =>
        new StackedAreaChartState({
            manager: {
                table,
                selection: new SelectionArray(table.availableEntityNames),
                yColumnSlugs: [
                    SampleColumnSlugs.Fruit,
                    SampleColumnSlugs.Vegetables,
                ],
                ...manager,
            },
        })

    it("doesn't offer the metric strategy for percentages", () => {
        const table = makeTable("%", "%")
        expect(
            makeChartState(table, { isRelativeMode: false })
                .availableFacetStrategies
        ).toEqual([FacetStrategy.entity])
        expect(
            makeChartState(table, { isRelativeMode: true })
                .availableFacetStrategies
        ).toEqual([FacetStrategy.entity])
    })

    it("doesn't offer the entity strategy for mixed units", () => {
        const table = makeTable("t", "kg")
        expect(
            makeChartState(table, { isRelativeMode: false })
                .availableFacetStrategies
        ).toEqual([FacetStrategy.metric])
        expect(
            makeChartState(table, { isRelativeMode: true })
                .availableFacetStrategies
        ).toEqual([FacetStrategy.metric])
    })
})

describe("a category with negative values", () => {
    // Shaped like co2-emissions-fossil-land, where land-use change is a carbon
    // sink and every other category is a source
    const csv = `fossil,landUse,year,entityName
    100,-20,1990,Germany
    120,-30,2000,Germany`
    const table = new OwidTable(csv, [
        { slug: "fossil", type: ColumnTypeNames.Numeric },
        { slug: "landUse", type: ColumnTypeNames.Numeric },
        { slug: "year", type: ColumnTypeNames.Year },
    ])
    const makeChartState = (): StackedAreaChartState =>
        new StackedAreaChartState({
            manager: {
                table,
                yColumnSlugs: ["fossil", "landUse"],
                selection: table.availableEntityNames,
            },
        })

    const bandsOf = (
        chartState: StackedAreaChartState,
        seriesName: string
    ): [number, number][] =>
        chartState.seriesByName
            .get(seriesName)!
            .points.map((point) => [
                point.valueOffset,
                point.valueOffset + point.value,
            ])

    it("hangs the negative category below the zero line", () => {
        expect(bandsOf(makeChartState(), "landUse")).toEqual([
            [0, -20],
            [0, -30],
        ])
    })

    it("rests the positive categories on the zero line", () => {
        expect(bandsOf(makeChartState(), "fossil")).toEqual([
            [0, 100],
            [0, 120],
        ])
    })

    it("extends the y domain below zero", () => {
        expect(makeChartState().yDomain).toEqual([-30, 120])
    })

    it("centres each series label on its own band", () => {
        expect(makeChartState().midpoints).toEqual([-15, 60])
    })
})

describe("a category that changes sign over time", () => {
    // The shape every published chart with negatives actually has: land-use
    // change is a source until 1949 and a sink after it
    const csv = `fossil,landUse,year,entityName
    100,20,1990,Germany
    120,-30,2000,Germany`
    const table = new OwidTable(csv, [
        { slug: "fossil", type: ColumnTypeNames.Numeric },
        { slug: "landUse", type: ColumnTypeNames.Numeric },
        { slug: "year", type: ColumnTypeNames.Year },
    ])
    const chartState = new StackedAreaChartState({
        manager: {
            table,
            yColumnSlugs: ["fossil", "landUse"],
            selection: table.availableEntityNames,
        },
    })

    const bandsOf = (seriesName: string): [number, number][] =>
        chartState.seriesByName
            .get(seriesName)!
            .points.map((point) => [
                point.valueOffset,
                point.valueOffset + point.value,
            ])

    it("moves the category across the zero line at the crossing", () => {
        expect(bandsOf("landUse")).toEqual([
            [0, 20],
            [0, -30],
        ])
    })

    it("drops the category above it back onto the zero line", () => {
        expect(bandsOf("fossil")).toEqual([
            [20, 120],
            [0, 120],
        ])
    })

    it("extends the y domain below zero", () => {
        expect(chartState.yDomain).toEqual([-30, 120])
    })
})

describe("a negative category that is not at the bottom", () => {
    const csv = `coal,netImports,wind,year,entityName
    100,-20,40,1990,Germany
    120,-30,50,2000,Germany`
    const table = new OwidTable(csv, [
        { slug: "coal", type: ColumnTypeNames.Numeric },
        { slug: "netImports", type: ColumnTypeNames.Numeric },
        { slug: "wind", type: ColumnTypeNames.Numeric },
        { slug: "year", type: ColumnTypeNames.Year },
    ])
    const chartState = new StackedAreaChartState({
        manager: {
            table,
            yColumnSlugs: ["wind", "netImports", "coal"],
            selection: table.availableEntityNames,
        },
    })

    const bandsOf = (seriesName: string): [number, number][] =>
        chartState.seriesByName
            .get(seriesName)!
            .points.map((point) => [
                point.valueOffset,
                point.valueOffset + point.value,
            ])

    it("hangs it below the zero line and closes the gap it leaves behind", () => {
        expect(bandsOf("coal")).toEqual([
            [0, 100],
            [0, 120],
        ])
        expect(bandsOf("netImports")).toEqual([
            [0, -20],
            [0, -30],
        ])
        expect(bandsOf("wind")).toEqual([
            [100, 140],
            [120, 170],
        ])
    })
})

describe("several categories with negative values", () => {
    const csv = `halons,methylBromide,cfc,year,entityName
    100,-20,-10,1990,World
    120,-30,-15,2000,World`
    const table = new OwidTable(csv, [
        { slug: "halons", type: ColumnTypeNames.Numeric },
        { slug: "methylBromide", type: ColumnTypeNames.Numeric },
        { slug: "cfc", type: ColumnTypeNames.Numeric },
        { slug: "year", type: ColumnTypeNames.Year },
    ])
    const chartState = new StackedAreaChartState({
        manager: {
            table,
            yColumnSlugs: ["halons", "methylBromide", "cfc"],
            selection: table.availableEntityNames,
        },
    })

    const bandsOf = (seriesName: string): [number, number][] =>
        chartState.seriesByName
            .get(seriesName)!
            .points.map((point) => [
                point.valueOffset,
                point.valueOffset + point.value,
            ])

    it("stacks them downward from the zero line, under the positive ones", () => {
        expect(bandsOf("cfc")).toEqual([
            [0, -10],
            [0, -15],
        ])
        expect(bandsOf("methylBromide")).toEqual([
            [-10, -30],
            [-15, -45],
        ])
        expect(bandsOf("halons")).toEqual([
            [0, 100],
            [0, 120],
        ])
    })
})
