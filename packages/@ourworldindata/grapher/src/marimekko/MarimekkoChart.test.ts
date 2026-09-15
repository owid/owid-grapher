import { expect, it, test } from "vitest"

import { Bounds, ColumnTypeNames } from "@ourworldindata/utils"
import {
    OwidTable,
    SampleColumnSlugs,
    SynthesizeGDPTable,
} from "@ourworldindata/core-table"
import { GrapherState } from "../core/GrapherState"
import { GrapherProgrammaticInterface } from "../core/Grapher.js"
import {
    GRAPHER_CHART_TYPES,
    GRAPHER_TAB_CONFIG_OPTIONS,
} from "@ourworldindata/types"
import { MarimekkoChart } from "./MarimekkoChart"
import { MarimekkoChartManager } from "./MarimekkoChartConstants"
import { MarimekkoChartState } from "./MarimekkoChartState"
import { numericDefs, stringDefs, yearDef } from "../testData/columnDefs.js"

function makeMarimekko(
    table: OwidTable,
    config: Partial<GrapherProgrammaticInterface> = {},
    bounds = new Bounds(0, 0, 1000, 1000)
): { chartState: MarimekkoChartState; chart: MarimekkoChart } {
    const grapher = new GrapherState({
        chartTypes: [GRAPHER_CHART_TYPES.Marimekko],
        table,
        ySlugs: "percentBelow2USD",
        xSlug: "population",
        maxTime: 2001,
        ...config,
    })
    const chartState = new MarimekkoChartState({ manager: grapher })
    const chart = new MarimekkoChart({ chartState, bounds })
    return { chartState, chart }
}

const barOffsets = (chart: MarimekkoChart): number[] => {
    const axis = chart["dualAxis"].horizontalAxis
    return chart.placedSeries.map((series) => series.barX - axis.place(0))
}

it("can create a chart", () => {
    const table = SynthesizeGDPTable({
        timeRange: [2000, 2001],
        entityCount: 5,
    })
    const manager = {
        table,
        yColumnSlugs: [SampleColumnSlugs.GDP],
        xColumnSlug: SampleColumnSlugs.Population,
        showNoDataArea: false,
    }

    const chartState = new MarimekkoChartState({ manager })
    const chart = new MarimekkoChart({ chartState })

    expect(chartState.errorInfo.reason).toEqual("")
    expect(chartState.series.length).toEqual(5)
    expect(
        chartState.series.every((series) => series.xPoint !== undefined)
    ).toBe(true)
    expect(chart.placedSeries.length).toEqual(5)
})

it("can display a Marimekko chart correctly", () => {
    const table = new OwidTable(
        [
            ["year", "entityName", "population", "percentBelow2USD"],
            [2001, "medium", 4000, 4],
            [2001, "big", 5000, 8],
            [2001, "small", 1000, 3],
        ],
        [...numericDefs("population", "percentBelow2USD"), yearDef()]
    )

    const manager: MarimekkoChartManager = {
        table,
        yColumnSlugs: ["percentBelow2USD"],
        xColumnSlug: "population",
        endTime: 2001,
        showNoDataArea: false,
    }
    const chartState = new MarimekkoChartState({ manager })
    const chart = new MarimekkoChart({
        chartState,
        bounds: new Bounds(0, 0, 1000, 1000),
    })
    const xAxisRange = chart["dualAxis"].horizontalAxis.rangeSize

    expect(chartState.errorInfo.reason).toEqual("")
    expect(chartState.series.length).toEqual(3)

    expect(
        chartState.series.map((s) => [
            s.seriesName,
            s.yPoint?.value,
            s.xPoint?.value,
        ])
    ).toEqual([
        ["medium", 4, 4000],
        ["big", 8, 5000],
        ["small", 3, 1000],
    ])

    expect(
        chart.placedSeries.map((s) => [
            s.seriesName,
            s.yPoint?.value,
            s.xPoint?.value,
        ])
    ).toEqual([
        ["big", 8, 5000],
        ["medium", 4, 4000],
        ["small", 3, 1000],
    ])

    const xPositions = barOffsets(chart)
    expect(xPositions[0]).toEqual(0)
    expect(xPositions[1]).toBeCloseTo(xAxisRange * 0.5, 0)
    expect(xPositions[2]).toBeCloseTo(xAxisRange * 0.9, 0)
})

it("sorts entities by y value, largest first", () => {
    const table = new OwidTable(
        [
            ["year", "entityName", "population", "percentBelow2USD"],
            [2001, "AA", 4000, 4],
            [2001, "BB", 5000, 8],
            [2001, "CC", 1000, 3],
        ],
        [...numericDefs("population", "percentBelow2USD"), yearDef()]
    )

    const chartState = new MarimekkoChartState({
        manager: {
            table,
            yColumnSlugs: ["percentBelow2USD"],
            xColumnSlug: "population",
            endTime: 2001,
            showNoDataArea: false,
        },
    })

    expect(chartState.errorInfo.reason).toEqual("")
    expect(chartState.sortedSeries.map((series) => series.entityName)).toEqual([
        "BB",
        "AA",
        "CC",
    ])
})

it("can filter years correctly", () => {
    const table = new OwidTable(
        [
            ["year", "entityName", "population", "percentBelow2USD"],
            [2000, "medium", 4000, 5],
            [2000, "big", 5000, 10],
            [2000, "small", 800, 2],
            [2001, "medium", 4000, 4],
            [2001, "big", 5000, 8],
            [2001, "small", 1000, 3],
        ],
        [...numericDefs("population", "percentBelow2USD"), yearDef()]
    )

    const { chartState, chart } = makeMarimekko(table)
    const xAxisRange = chart["dualAxis"].horizontalAxis.rangeSize

    expect(chartState.errorInfo.reason).toEqual("")
    expect(chartState.series.length).toEqual(3)

    expect(chartState.series.map((s) => s.xPoint?.time)).toEqual([
        2001, 2001, 2001,
    ])

    expect(
        chart.placedSeries.map((s) => [
            s.seriesName,
            s.yPoint?.value,
            s.xPoint?.value,
        ])
    ).toEqual([
        ["big", 8, 5000],
        ["medium", 4, 4000],
        ["small", 3, 1000],
    ])

    const xPositions = barOffsets(chart)
    expect(xPositions[0]).toEqual(0)
    expect(xPositions[1]).toBeCloseTo(xAxisRange * 0.5, 0)
    expect(xPositions[2]).toBeCloseTo(xAxisRange * 0.9, 0)
})

it("shows no data points at the end", () => {
    const table = new OwidTable(
        [
            ["year", "entityName", "population", "percentBelow2USD"],
            [2000, "medium", 4000, 5],
            [2000, "big", 5000, 10],
            [2000, "small", 800, 2],
            [2001, "medium", 4000, null],
            [2001, "big", 5000, 8],
            [2001, "small", 1000, 3],
        ],
        [...numericDefs("population", "percentBelow2USD"), yearDef()]
    )

    const { chartState, chart } = makeMarimekko(
        table,
        {},
        new Bounds(0, 0, 1001, 1000)
    )
    const xAxisRange = chart["dualAxis"].horizontalAxis.rangeSize

    expect(chartState.errorInfo.reason).toEqual("")
    expect(chartState.series.length).toEqual(3)

    expect(chartState.series.map((s) => s.xPoint?.time)).toEqual([
        2001, 2001, 2001,
    ])

    expect(
        chart.placedSeries.map((s) => [
            s.seriesName,
            s.yPoint?.value,
            s.xPoint?.value,
        ])
    ).toEqual([
        ["big", 8, 5000],
        ["small", 3, 1000],
        ["medium", undefined, 4000],
    ])

    const xPositions = barOffsets(chart)
    expect(xPositions[0]).toEqual(0)
    expect(xPositions[1]).toBeCloseTo(xAxisRange * 0.5, 0)
    expect(xPositions[2]).toBeCloseTo(xAxisRange * 0.6, 0)
})

test("interpolation works as expected", () => {
    const table = new OwidTable(
        [
            ["year", "entityName", "population", "percentBelow2USD"],
            [2000, "medium", 4000, 5],
            [2000, "big", 5000, 10],
            [2000, "small", 800, 2],
            [2001, "medium", 4000, 4],
            [2001, "big", null, 8],
            [2001, "small", 1000, null],
        ],
        [
            { slug: "population", type: ColumnTypeNames.Numeric, tolerance: 1 },
            {
                slug: "percentBelow2USD",
                type: ColumnTypeNames.Numeric,
                tolerance: 1,
            },
            yearDef(),
        ]
    )

    const { chartState, chart } = makeMarimekko(table)
    const xAxisRange = chart["dualAxis"].horizontalAxis.rangeSize

    expect(chartState.errorInfo.reason).toEqual("")
    expect(chartState.series.length).toEqual(3)

    const expectedXPoints = [
        { value: 5000, time: 2000 },
        { value: 4000, time: 2001 },
        { value: 1000, time: 2001 },
    ]
    expect(chartState.series.map((series) => series.xPoint)).toEqual(
        expectedXPoints
    )

    expect(
        chart.placedSeries.map((s) => [s.seriesName, s.yPoint, s.xPoint])
    ).toEqual([
        ["big", { value: 8, time: 2001 }, expectedXPoints[0]],
        ["medium", { value: 4, time: 2001 }, expectedXPoints[1]],
        ["small", { value: 2, time: 2000 }, expectedXPoints[2]],
    ])

    const xPositions = barOffsets(chart)
    expect(xPositions[0]).toEqual(0)
    expect(xPositions[1]).toBeCloseTo(xAxisRange * 0.5, 0)
    expect(xPositions[2]).toBeCloseTo(xAxisRange * 0.9, 0)
})

it("can deal with a y column with missing values", () => {
    const table = new OwidTable(
        [
            ["year", "entityName", "population", "percentBelow10USD"],
            [2000, "medium", 4000, 10],
            [2000, "big", 5000, 20],
            [2000, "small", 800, 4],
            [2001, "medium", 4000, 8],
            [2001, "big", 5000, null],
            [2001, "small", 1000, 6],
        ],
        [...numericDefs("population", "percentBelow10USD"), yearDef()]
    )

    const { chartState, chart } = makeMarimekko(table, {
        ySlugs: "percentBelow10USD",
    })
    const xAxisRange = chart["dualAxis"].horizontalAxis.rangeSize

    expect(chartState.errorInfo.reason).toEqual("")
    expect(chartState.series.length).toEqual(3)

    expect(chartState.series.map((s) => s.xPoint?.time)).toEqual([
        2001, 2001, 2001,
    ])

    expect(
        chart.placedSeries.map((s) => [
            s.seriesName,
            s.yPoint?.value,
            s.xPoint?.value,
        ])
    ).toEqual([
        ["medium", 8, 4000],
        ["small", 6, 1000],
        ["big", undefined, 5000],
    ])

    const xPositions = barOffsets(chart)
    expect(xPositions[0]).toEqual(0)
    expect(xPositions[1]).toBeCloseTo(xAxisRange * 0.4, 0)
    expect(xPositions[2]).toBeCloseTo(xAxisRange * 0.5, 0)
})

it("does not extend time range based on color column data", () => {
    const table = new OwidTable(
        [
            ["year", "entityName", "maternalMortality", "region"],
            [2018, "Belarus", 4, "Europe"],
            [2019, "Belarus", 3, "Europe"],
            [2020, "Belarus", 2, "Europe"],
            [2018, "Afghanistan", 100, "Asia"],
            [2019, "Afghanistan", 95, "Asia"],
            [2020, "Afghanistan", 90, "Asia"],
            [2021, "Belarus", null, "Europe"],
            [2022, "Belarus", null, "Europe"],
            [2023, "Belarus", null, "Europe"],
            [2021, "Afghanistan", null, "Asia"],
            [2022, "Afghanistan", null, "Asia"],
            [2023, "Afghanistan", null, "Asia"],
        ],
        [
            {
                slug: "maternalMortality",
                type: ColumnTypeNames.Numeric,
                tolerance: 5,
            },
            ...stringDefs("region"),
            yearDef(),
        ]
    )

    const { chartState } = makeMarimekko(table, {
        ySlugs: "maternalMortality",
        xSlug: undefined,
        colorSlug: "region",
        maxTime: 2023,
        showNoDataArea: false,
    })

    const transformedTable = chartState.transformedTable
    const years = transformedTable.timeColumn.uniqValues

    expect(Math.max(...(years as number[]))).toBeLessThanOrEqual(2020)

    expect(
        chartState.series.every((series) => (series.yPoint?.time ?? 0) <= 2020)
    ).toBe(true)
})

it("ignores x-axis when scatter is also available", () => {
    const table = SynthesizeGDPTable({
        timeRange: [2000, 2001],
        entityCount: 5,
    })

    const grapher = new GrapherState({
        table,
        chartTypes: [
            GRAPHER_CHART_TYPES.ScatterPlot,
            GRAPHER_CHART_TYPES.Marimekko,
        ],
        tab: GRAPHER_TAB_CONFIG_OPTIONS.marimekko,
        ySlugs: SampleColumnSlugs.GDP,
        xSlug: SampleColumnSlugs.Population,
    })

    const marimekkoState = grapher.chartState as MarimekkoChartState

    expect(marimekkoState.xColumnSlug).toBeUndefined()
})

it("doesn't label entities that are absent at the selected time", () => {
    const table = new OwidTable(
        [
            ["year", "entityName", "population", "percentBelow2USD"],
            [2000, "medium", 4000, 5],
            [2000, "big", 5000, 10],
            [2000, "small", 800, 2],
            [2001, "medium", 4000, 4],
            [2001, "big", 5000, 8],
            [2001, "small", 1000, 3],
            [2001, "newcomer", 9000, 99],
        ],
        [...numericDefs("population", "percentBelow2USD"), yearDef()]
    )

    const { chart } = makeMarimekko(table, { maxTime: 2000 })

    expect(chart["latestTime"]).toEqual(2001)
    expect(chart.placedSeries.map((series) => series.entityName)).toEqual([
        "big",
        "medium",
        "small",
    ])

    const candidateNames = chart["pickedLabelCandidates"].map(
        (candidate) => candidate.entityName
    )
    const labelNames = chart["placedLabels"].map((label) => label.entityName)

    expect(candidateNames).not.toContain("newcomer")
    expect(labelNames.toSorted()).toEqual(candidateNames.toSorted())
})
