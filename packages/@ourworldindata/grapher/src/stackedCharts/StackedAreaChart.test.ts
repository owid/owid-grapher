import * as _ from "lodash-es"
import { expect, it, describe } from "vitest"

import { StackedAreaChart } from "./StackedAreaChart"
import {
    SampleColumnSlugs,
    SynthesizeFruitTable,
    SynthesizeFruitTableWithStringValues,
    SynthesizeGDPTable,
    OwidTable,
} from "@ourworldindata/core-table"

import { makeObservable, observable } from "mobx"
import { AxisConfig } from "../axis/AxisConfig"
import { SelectionArray } from "../selection/SelectionArray"
import {
    ColumnTypeNames,
    FacetStrategy,
    GRAPHER_CHART_TYPES,
} from "@ourworldindata/utils"
import { StackedAreaChartState } from "./StackedAreaChartState.js"
import { ChartManager } from "../chart/ChartManager"

class MockManager implements ChartManager {
    constructor() {
        makeObservable(this)
    }

    table = SynthesizeGDPTable({
        timeRange: [1950, 2010],
    })
    yColumnSlugs = [SampleColumnSlugs.GDP]
    yAxisConfig = new AxisConfig({ min: 0, max: 200 })
    @observable isRelativeMode = false
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
    }).replaceRandomCells(6, [SampleColumnSlugs.Fruit])
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
    const csv = `gdp,year,entityName
    ,2000,france
    ,2001,france
    1,2002,france
    2,2003,france
    8,2004,france
    ,2005,france
    ,2000,uk
    ,2001,uk
    5,2002,uk
    18,2003,uk
    2,2004,uk
    ,2005,uk`
    const table = new OwidTable(csv, [
        { slug: "gdp", type: ColumnTypeNames.Numeric },
        { slug: "year", type: ColumnTypeNames.Year },
    ])
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

it("should mark interpolated values as fake", () => {
    const csv = `gdp,year,entityName
    10,2000,france
    0,2001,france
    ,2002,france
    ,2003,france
    8,2005,france
    ,2006,france
    2,2000,uk
    3,2004,uk`
    const table = new OwidTable(csv, [
        { slug: "gdp", type: ColumnTypeNames.Numeric },
        { slug: "year", type: ColumnTypeNames.Year },
    ])

    const manager: ChartManager = {
        table,
        yColumnSlugs: ["gdp"],
        selection: table.availableEntityNames,
    }

    const chartState = new StackedAreaChartState({ manager })

    // indices are reversed because stacked charts reverse the stacking order
    const pointsFrance = chartState.series[1].points
    const pointsUK = chartState.series[0].points

    // year 2000
    expect(pointsFrance[0].interpolated).toBeFalsy()
    expect(pointsFrance[0].fake).toBeFalsy()
    expect(pointsUK[0].interpolated).toBeFalsy()
    expect(pointsUK[0].fake).toBeFalsy()

    // year = 2001
    expect(pointsFrance[1].interpolated).toBeFalsy()
    expect(pointsFrance[1].fake).toBeFalsy()
    expect(pointsUK[1].interpolated).toBeTruthy()
    expect(pointsUK[1].fake).toBeTruthy()

    // year = 2004
    expect(pointsFrance[2].interpolated).toBeTruthy()
    expect(pointsFrance[2].fake).toBeTruthy()
    expect(pointsUK[2].interpolated).toBeFalsy()
    expect(pointsUK[2].fake).toBeFalsy()

    // year = 2005
    expect(pointsFrance[3].interpolated).toBeFalsy()
    expect(pointsFrance[3].fake).toBeFalsy()
    expect(pointsUK[3].interpolated).toBeFalsy()
    expect(pointsUK[3].fake).toBeTruthy() // true since it's zero-filled
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
            manager: { ...baseManager, showLegend: true },
        })
        const chart = new StackedAreaChart({ chartState })
        expect(chart.externalLegend).toBeUndefined()
    })

    it("exposes externalLegendBins when legend is hidden", () => {
        const chartState = new StackedAreaChartState({
            manager: { ...baseManager, showLegend: false },
        })
        const chart = new StackedAreaChart({ chartState })
        expect(chart.externalLegend?.categoricalLegendData?.length).toEqual(2)
    })
})

describe("availableFacetStrategies (multi entity, single column)", () => {
    const table = SynthesizeGDPTable({
        timeRange: [1950, 2020],
        entityNames: [
            "France",
            "Spain",
            "Sudan",
            "China",
            "Europe",
            "Africa",
            "Asia",
            "World",
        ],
    })

    const manager: ChartManager = {
        table,
        yColumnSlugs: [SampleColumnSlugs.GDP],
    }

    it("allows stacking countries", () => {
        const chartState = new StackedAreaChartState({
            manager: {
                ...manager,
                selection: ["France", "Spain", "Sudan", "China"],
            },
        })
        expect(chartState.availableFacetStrategies).toContain(
            FacetStrategy.none
        )
    })

    it("allows stacking continents", () => {
        const chartState = new StackedAreaChartState({
            manager: {
                ...manager,
                selection: ["Europe", "Africa", "Asia"],
            },
        })
        expect(chartState.availableFacetStrategies).toContain(
            FacetStrategy.none
        )
    })

    it("allows stacking countries on top of unrelated continents", () => {
        const chartState = new StackedAreaChartState({
            manager: {
                ...manager,
                selection: ["France", "Spain", "China", "Africa"],
            },
        })
        expect(chartState.availableFacetStrategies).toContain(
            FacetStrategy.none
        )
    })

    it("doesn't allow stacking countries on top of their continent", () => {
        const chartState = new StackedAreaChartState({
            manager: {
                ...manager,
                selection: ["France", "Spain", "China", "Europe"],
            },
        })
        expect(chartState.availableFacetStrategies).not.toContain(
            FacetStrategy.none
        )
    })

    it("doesn't allow stacking World on top of countries", () => {
        const chartState = new StackedAreaChartState({
            manager: { ...manager, selection: ["Germany", "World"] },
        })
        expect(chartState.availableFacetStrategies).not.toContain(
            FacetStrategy.none
        )
    })

    it("doesn't allow stacking World on top of continents", () => {
        const chartState = new StackedAreaChartState({
            manager: { ...manager, selection: ["World", "Europe"] },
        })
        expect(chartState.availableFacetStrategies).not.toContain(
            FacetStrategy.none
        )
    })
})

describe("availableFacetStrategies (multi entity, multi column)", () => {
    const table = SynthesizeGDPTable({
        timeRange: [1950, 2020],
        entityNames: [
            "France",
            "Spain",
            "Sudan",
            "China",
            "Europe",
            "Africa",
            "Asia",
            "World",
        ],
    })

    const manager: ChartManager = {
        table,
        yColumnSlugs: [SampleColumnSlugs.GDP, SampleColumnSlugs.LifeExpectancy],
    }

    it("allows stacking countries", () => {
        const chartState = new StackedAreaChartState({
            manager: {
                ...manager,
                selection: ["France", "Spain", "Sudan", "China"],
            },
        })
        expect(chartState.availableFacetStrategies).toContain(
            FacetStrategy.metric
        )
    })

    it("allows stacking continents", () => {
        const chartState = new StackedAreaChartState({
            manager: {
                ...manager,
                selection: ["Europe", "Africa", "Asia"],
            },
        })
        expect(chartState.availableFacetStrategies).toContain(
            FacetStrategy.metric
        )
    })

    it("allows stacking countries on top of unrelated continents", () => {
        const chartState = new StackedAreaChartState({
            manager: {
                ...manager,
                selection: ["France", "Spain", "China", "Africa"],
            },
        })
        expect(chartState.availableFacetStrategies).toContain(
            FacetStrategy.metric
        )
    })

    it("doesn't allow stacking countries on top of their continent", () => {
        const chartState = new StackedAreaChartState({
            manager: {
                ...manager,
                selection: ["France", "Spain", "China", "Europe"],
            },
        })
        expect(chartState.availableFacetStrategies).not.toContain(
            FacetStrategy.metric
        )
    })

    it("doesn't allow stacking World on top of countries", () => {
        const chartState = new StackedAreaChartState({
            manager: { ...manager, selection: ["Germany", "World"] },
        })
        expect(chartState.availableFacetStrategies).not.toContain(
            FacetStrategy.metric
        )
    })

    it("doesn't allow stacking World on top of continents", () => {
        const chartState = new StackedAreaChartState({
            manager: { ...manager, selection: ["World", "Europe"] },
        })
        expect(chartState.availableFacetStrategies).not.toContain(
            FacetStrategy.metric
        )
    })
})
