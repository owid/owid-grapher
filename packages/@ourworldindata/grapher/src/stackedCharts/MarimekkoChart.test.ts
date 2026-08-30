import { expect, it, test } from "vitest"

import * as _ from "lodash-es"
import { Bounds, ColumnTypeNames } from "@ourworldindata/utils"
import {
    OwidTable,
    SampleColumnSlugs,
    SynthesizeGDPTable,
} from "@ourworldindata/core-table"
import { DefaultColorScheme } from "../color/CustomSchemes"
import { GrapherState } from "../core/GrapherState"
import {
    GRAPHER_CHART_TYPES,
    GRAPHER_TAB_CONFIG_OPTIONS,
    SortBy,
    SortOrder,
} from "@ourworldindata/types"
import { MarimekkoChart } from "./MarimekkoChart"
import {
    MarimekkoChartManager,
    MarimekkoSeries,
} from "./MarimekkoChartConstants"
import { MarimekkoChartState } from "./MarimekkoChartState"
import { InteractionState } from "../interaction/InteractionState.js"

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
    expect(chartState.xSeries!.points.length).toEqual(5)
    expect(chart.placedSeries.length).toEqual(5)
})

it("can display a Marimekko chart correctly", () => {
    const csv = `year,entityName,population,percentBelow2USD
2001,medium,4000,4
2001,big,5000,8
2001,small,1000,3`
    const table = new OwidTable(csv, [
        { slug: "population", type: ColumnTypeNames.Numeric },
        { slug: "percentBelow2USD", type: ColumnTypeNames.Numeric },
        { slug: "year", type: ColumnTypeNames.Year },
    ])

    const manager: MarimekkoChartManager = {
        table,
        selection: table.availableEntityNames,
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

    const expectedXPoints = [
        { value: 4000, entity: "medium", time: 2001 },
        { value: 5000, entity: "big", time: 2001 },
        { value: 1000, entity: "small", time: 2001 },
    ]
    expect(chartState.series).toEqual([
        {
            seriesName: "medium",
            entityName: "medium",
            shortEntityName: undefined,
            yPoint: { value: 4, time: 2001 },
            xPoint: expectedXPoints[0],
            color: DefaultColorScheme.colorSets[0][0],
            entityColor: undefined,
            focus: new InteractionState(),
        },
        {
            seriesName: "big",
            entityName: "big",
            shortEntityName: undefined,
            yPoint: { value: 8, time: 2001 },
            xPoint: expectedXPoints[1],
            color: DefaultColorScheme.colorSets[0][0],
            entityColor: undefined,
            focus: new InteractionState(),
        },
        {
            seriesName: "small",
            entityName: "small",
            shortEntityName: undefined,
            yPoint: { value: 3, time: 2001 },
            xPoint: expectedXPoints[2],
            color: DefaultColorScheme.colorSets[0][0],
            entityColor: undefined,
            focus: new InteractionState(),
        },
    ])
    expect(chartState.xSeries!.points).toEqual(expectedXPoints)

    const placedSeriesWithoutXPosition = chart.placedSeries.map((series) =>
        _.omit(series, "xPosition")
    )
    const xPositions = chart.placedSeries.map((series) => series.xPosition)

    // placedSeries should be in default sort order
    expect(placedSeriesWithoutXPosition).toEqual([
        {
            seriesName: "big",
            entityName: "big",
            entityColor: undefined,
            yPoint: { value: 8, time: 2001 },
            xPoint: expectedXPoints[1],
            color: DefaultColorScheme.colorSets[0][0],
            shortEntityName: undefined,
            focus: new InteractionState(),
        },
        {
            seriesName: "medium",
            entityName: "medium",
            entityColor: undefined,
            yPoint: { value: 4, time: 2001 },
            xPoint: expectedXPoints[0],
            color: DefaultColorScheme.colorSets[0][0],
            shortEntityName: undefined,
            focus: new InteractionState(),
        },
        {
            seriesName: "small",
            entityName: "small",
            entityColor: undefined,
            yPoint: { value: 3, time: 2001 },
            xPoint: expectedXPoints[2],
            color: DefaultColorScheme.colorSets[0][0],
            shortEntityName: undefined,
            focus: new InteractionState(),
        },
    ])

    expect(xPositions[0]).toEqual(0)
    expect(xPositions[1]).toBeCloseTo(xAxisRange * 0.5, 0)
    expect(xPositions[2]).toBeCloseTo(xAxisRange * 0.9, 0)
})

it("can do sorting", () => {
    const csv = `year,entityName,population,percentBelow2USD
2001,AA,4000,4
2001,BB,5000,8
2001,CC,1000,3`
    const table = new OwidTable(csv, [
        { slug: "population", type: ColumnTypeNames.Numeric },
        { slug: "percentBelow2USD", type: ColumnTypeNames.Numeric },
        { slug: "year", type: ColumnTypeNames.Year },
    ])

    const manager: MarimekkoChartManager = {
        table,
        selection: table.availableEntityNames,
        yColumnSlugs: ["percentBelow2USD"],
        xColumnSlug: "population",
        endTime: 2001,
        showNoDataArea: false,
    }
    let chartState = new MarimekkoChartState({
        manager: {
            ...manager,
            sortConfig: {
                sortBy: SortBy.total,
                sortOrder: SortOrder.asc,
            },
        },
    })

    expect(chartState.errorInfo.reason).toEqual("")
    expect(chartState.series.length).toEqual(3)

    const expectedXPoints = [
        { value: 4000, entity: "AA", time: 2001 },
        { value: 5000, entity: "BB", time: 2001 },
        { value: 1000, entity: "CC", time: 2001 },
    ]
    expect(chartState.series).toEqual([
        {
            seriesName: "AA",
            entityName: "AA",
            shortEntityName: undefined,
            yPoint: { value: 4, time: 2001 },
            xPoint: expectedXPoints[0],
            color: DefaultColorScheme.colorSets[0][0],
            entityColor: undefined,
            focus: new InteractionState(),
        },
        {
            seriesName: "BB",
            entityName: "BB",
            shortEntityName: undefined,
            yPoint: { value: 8, time: 2001 },
            xPoint: expectedXPoints[1],
            color: DefaultColorScheme.colorSets[0][0],
            entityColor: undefined,
            focus: new InteractionState(),
        },
        {
            seriesName: "CC",
            entityName: "CC",
            shortEntityName: undefined,
            yPoint: { value: 3, time: 2001 },
            xPoint: expectedXPoints[2],
            color: DefaultColorScheme.colorSets[0][0],
            entityColor: undefined,
            focus: new InteractionState(),
        },
    ])
    expect(chartState.xSeries!.points).toEqual(expectedXPoints)

    const series = new Map<string, MarimekkoSeries>([
        [
            "big",
            {
                seriesName: "BB",
                entityName: "BB",
                shortEntityName: undefined,
                yPoint: { value: 8, time: 2001 },
                xPoint: expectedXPoints[1],
                color: DefaultColorScheme.colorSets[0][0],
                entityColor: undefined,
                focus: new InteractionState(),
            },
        ],
        [
            "medium",
            {
                seriesName: "AA",
                entityName: "AA",
                shortEntityName: undefined,
                yPoint: { value: 4, time: 2001 },
                xPoint: expectedXPoints[0],
                color: DefaultColorScheme.colorSets[0][0],
                entityColor: undefined,
                focus: new InteractionState(),
            },
        ],
        [
            "small",
            {
                seriesName: "CC",
                entityName: "CC",
                shortEntityName: undefined,
                yPoint: { value: 3, time: 2001 },
                xPoint: expectedXPoints[2],
                color: DefaultColorScheme.colorSets[0][0],
                entityColor: undefined,
                focus: new InteractionState(),
            },
        ],
    ])
    expect(chartState.sortedSeries).toEqual([
        series.get("small"),
        series.get("medium"),
        series.get("big"),
    ])

    chartState = new MarimekkoChartState({
        manager: {
            ...manager,
            sortConfig: {
                sortBy: SortBy.column,
                sortColumnSlug: "percentBelow2USD",
                sortOrder: SortOrder.asc,
            },
        },
    })
    expect(chartState.sortedSeries).toEqual([
        series.get("small"),
        series.get("medium"),
        series.get("big"),
    ])

    chartState = new MarimekkoChartState({
        manager: {
            ...manager,
            sortConfig: {
                sortBy: SortBy.entityName,
                sortOrder: SortOrder.asc,
            },
        },
    })
    expect(chartState.sortedSeries).toEqual([
        series.get("medium"),
        series.get("big"),
        series.get("small"),
    ])
})

it("can filter years correctly", () => {
    const csv = `year,entityName,population,percentBelow2USD
2000,medium,4000,5
2000,big,5000,10
2000,small,800,2
2001,medium,4000,4
2001,big,5000,8
2001,small,1000,3`
    const table = new OwidTable(csv, [
        { slug: "population", type: ColumnTypeNames.Numeric },
        { slug: "percentBelow2USD", type: ColumnTypeNames.Numeric },
        { slug: "year", type: ColumnTypeNames.Year },
    ])

    // TODO: why is it ySlugs and xSlug here instead of yColumnSlugs and xColumnSlug? Unify when we have config migrations?
    const manager = {
        chartTypes: [GRAPHER_CHART_TYPES.Marimekko],
        table,
        selection: table.availableEntityNames,
        ySlugs: "percentBelow2USD",
        xSlug: "population",
        endTime: 2001,
    }
    const grapher = new GrapherState(manager)
    const chartState = new MarimekkoChartState({ manager: grapher })
    const chart = new MarimekkoChart({
        chartState,
        bounds: new Bounds(0, 0, 1000, 1000),
    })
    const xAxisRange = chart["dualAxis"].horizontalAxis.rangeSize

    expect(chartState.errorInfo.reason).toEqual("")
    expect(chartState.series.length).toEqual(3)

    const expectedXPoints = [
        { value: 4000, entity: "medium", time: 2001 },
        { value: 5000, entity: "big", time: 2001 },
        { value: 1000, entity: "small", time: 2001 },
    ]
    expect(chartState.xSeries!.points).toEqual(expectedXPoints)

    const placedSeriesWithoutXPosition = chart.placedSeries.map((series) =>
        _.omit(series, "xPosition")
    )
    const xPositions = chart.placedSeries.map((series) => series.xPosition)

    // placedSeries should be in default sort order
    expect(placedSeriesWithoutXPosition).toEqual([
        {
            seriesName: "big",
            entityName: "big",
            entityColor: undefined,
            yPoint: { value: 8, time: 2001 },
            xPoint: expectedXPoints[1],
            color: DefaultColorScheme.colorSets[0][0],
            shortEntityName: undefined,
            focus: new InteractionState(),
        },
        {
            seriesName: "medium",
            entityName: "medium",
            entityColor: undefined,
            yPoint: { value: 4, time: 2001 },
            xPoint: expectedXPoints[0],
            color: DefaultColorScheme.colorSets[0][0],
            shortEntityName: undefined,
            focus: new InteractionState(),
        },
        {
            seriesName: "small",
            entityName: "small",
            entityColor: undefined,
            yPoint: { value: 3, time: 2001 },
            xPoint: expectedXPoints[2],
            color: DefaultColorScheme.colorSets[0][0],
            shortEntityName: undefined,
            focus: new InteractionState(),
        },
    ])

    expect(xPositions[0]).toEqual(0)
    expect(xPositions[1]).toBeCloseTo(xAxisRange * 0.5, 0)
    expect(xPositions[2]).toBeCloseTo(xAxisRange * 0.9, 0)
})

it("shows no data points at the end", () => {
    const csv = `year,entityName,population,percentBelow2USD
2000,medium,4000,5
2000,big,5000,10
2000,small,800,2
2001,medium,4000,
2001,big,5000,8
2001,small,1000,3`
    const table = new OwidTable(csv, [
        { slug: "population", type: ColumnTypeNames.Numeric },
        { slug: "percentBelow2USD", type: ColumnTypeNames.Numeric },
        { slug: "year", type: ColumnTypeNames.Year },
    ])

    // TODO: why is it ySlugs and xSlug here instead of yColumnSlugs and xColumnSlug? Unify when we have config migrations?
    const manager = {
        chartTypes: [GRAPHER_CHART_TYPES.Marimekko],
        table,
        selection: table.availableEntityNames,
        ySlugs: "percentBelow2USD",
        xSlug: "population",
        endTime: 2001,
    }
    const grapher = new GrapherState(manager)
    const chartState = new MarimekkoChartState({ manager: grapher })
    const chart = new MarimekkoChart({
        chartState,
        bounds: new Bounds(0, 0, 1001, 1000),
    })
    const xAxisRange = chart["dualAxis"].horizontalAxis.rangeSize

    expect(chartState.errorInfo.reason).toEqual("")
    expect(chartState.series.length).toEqual(3)

    const expectedXPoints = [
        { value: 4000, entity: "medium", time: 2001 },
        { value: 5000, entity: "big", time: 2001 },
        { value: 1000, entity: "small", time: 2001 },
    ]
    expect(chartState.xSeries!.points).toEqual(expectedXPoints)

    const placedSeriesWithoutXPosition = chart.placedSeries.map((series) =>
        _.omit(series, "xPosition")
    )
    const xPositions = chart.placedSeries.map((series) => series.xPosition)

    // placedSeries should be in default sort order, no-data entities last
    expect(placedSeriesWithoutXPosition).toEqual([
        {
            seriesName: "big",
            entityName: "big",
            entityColor: undefined,
            yPoint: { value: 8, time: 2001 },
            xPoint: expectedXPoints[1],
            color: DefaultColorScheme.colorSets[0][0],
            shortEntityName: undefined,
            focus: new InteractionState(),
        },
        {
            seriesName: "small",
            entityName: "small",
            entityColor: undefined,
            yPoint: { value: 3, time: 2001 },
            xPoint: expectedXPoints[2],
            color: DefaultColorScheme.colorSets[0][0],
            shortEntityName: undefined,
            focus: new InteractionState(),
        },
        {
            seriesName: "medium",
            entityName: "medium",
            entityColor: undefined,
            yPoint: undefined,
            xPoint: expectedXPoints[0],
            color: DefaultColorScheme.colorSets[0][0],
            shortEntityName: undefined,
            focus: new InteractionState(),
        },
    ])

    expect(xPositions[0]).toEqual(0)
    expect(xPositions[1]).toBeCloseTo(xAxisRange * 0.5, 0)
    expect(xPositions[2]).toBeCloseTo(xAxisRange * 0.6, 0)
})

test("interpolation works as expected", () => {
    const csv = `year,entityName,population,percentBelow2USD
2000,medium,4000,5
2000,big,5000,10
2000,small,800,2
2001,medium,4000,4
2001,big,,8
2001,small,1000,`
    const table = new OwidTable(csv, [
        { slug: "population", type: ColumnTypeNames.Numeric, tolerance: 1 },
        {
            slug: "percentBelow2USD",
            type: ColumnTypeNames.Numeric,
            tolerance: 1,
        },
        { slug: "year", type: ColumnTypeNames.Year },
    ])

    // TODO: why is it ySlugs and xSlug here instead of yColumnSlugs and xColumnSlug? Unify when we have config migrations?
    const manager = {
        chartTypes: [GRAPHER_CHART_TYPES.Marimekko],
        table,
        selection: table.availableEntityNames,
        ySlugs: "percentBelow2USD",
        xSlug: "population",
        endTime: 2001,
    }
    const grapher = new GrapherState(manager)
    const chartState = new MarimekkoChartState({ manager: grapher })
    const chart = new MarimekkoChart({
        chartState,
        bounds: new Bounds(0, 0, 1000, 1000),
    })
    const xAxisRange = chart["dualAxis"].horizontalAxis.rangeSize

    expect(chartState.errorInfo.reason).toEqual("")
    expect(chartState.series.length).toEqual(3)

    const expectedXPoints = [
        { value: 5000, entity: "big", time: 2000 },
        { value: 4000, entity: "medium", time: 2001 },
        { value: 1000, entity: "small", time: 2001 },
    ]
    expect(chartState.xSeries!.points).toEqual(expectedXPoints)

    const placedSeriesWithoutXPosition = chart.placedSeries.map((series) =>
        _.omit(series, "xPosition")
    )
    const xPositions = chart.placedSeries.map((series) => series.xPosition)

    // placedSeries should be in default sort order
    expect(placedSeriesWithoutXPosition).toEqual([
        {
            seriesName: "big",
            entityName: "big",
            entityColor: undefined,
            yPoint: { value: 8, time: 2001 },
            xPoint: expectedXPoints[0],
            color: DefaultColorScheme.colorSets[0][0],
            shortEntityName: undefined,
            focus: new InteractionState(),
        },
        {
            seriesName: "medium",
            entityName: "medium",
            entityColor: undefined,
            yPoint: { value: 4, time: 2001 },
            xPoint: expectedXPoints[1],
            color: DefaultColorScheme.colorSets[0][0],
            shortEntityName: undefined,
            focus: new InteractionState(),
        },
        {
            seriesName: "small",
            entityName: "small",
            entityColor: undefined,
            yPoint: { value: 2, time: 2000 },
            xPoint: expectedXPoints[2],
            color: DefaultColorScheme.colorSets[0][0],
            shortEntityName: undefined,
            focus: new InteractionState(),
        },
    ])

    expect(xPositions[0]).toEqual(0)
    expect(xPositions[1]).toBeCloseTo(xAxisRange * 0.5, 0)
    expect(xPositions[2]).toBeCloseTo(xAxisRange * 0.9, 0)
})

it("can deal with a y column with missing values", () => {
    const csv = `year,entityName,population,percentBelow10USD
2000,medium,4000,10
2000,big,5000,20
2000,small,800,4
2001,medium,4000,8
2001,big,5000,
2001,small,1000,6`
    const table = new OwidTable(csv, [
        { slug: "population", type: ColumnTypeNames.Numeric },
        { slug: "percentBelow10USD", type: ColumnTypeNames.Numeric },
        { slug: "year", type: ColumnTypeNames.Year },
    ])

    // TODO: why is it ySlugs and xSlug here instead of yColumnSlugs and xColumnSlug? Unify when we have config migrations?
    const manager = {
        chartTypes: [GRAPHER_CHART_TYPES.Marimekko],
        table,
        selection: table.availableEntityNames,
        ySlugs: "percentBelow10USD",
        xSlug: "population",
        endTime: 2001,
    }
    const grapher = new GrapherState(manager)
    const chartState = new MarimekkoChartState({ manager: grapher })
    const chart = new MarimekkoChart({
        chartState,
        bounds: new Bounds(0, 0, 1000, 1000),
    })
    const xAxisRange = chart["dualAxis"].horizontalAxis.rangeSize

    expect(chartState.errorInfo.reason).toEqual("")
    expect(chartState.series.length).toEqual(3)

    const expectedXPoints = [
        { value: 4000, entity: "medium", time: 2001 },
        { value: 5000, entity: "big", time: 2001 },
        { value: 1000, entity: "small", time: 2001 },
    ]
    expect(chartState.xSeries!.points).toEqual(expectedXPoints)

    const placedSeriesWithoutXPosition = chart.placedSeries.map((series) =>
        _.omit(series, "xPosition")
    )
    const xPositions = chart.placedSeries.map((series) => series.xPosition)
    // placedSeries should be in default sort order, no-data entities last
    expect(placedSeriesWithoutXPosition).toEqual([
        {
            seriesName: "medium",
            entityName: "medium",
            entityColor: undefined,
            yPoint: { value: 8, time: 2001 },
            xPoint: expectedXPoints[0],
            color: DefaultColorScheme.colorSets[0][0],
            shortEntityName: undefined,
            focus: new InteractionState(),
        },
        {
            seriesName: "small",
            entityName: "small",
            entityColor: undefined,
            yPoint: { value: 6, time: 2001 },
            xPoint: expectedXPoints[2],
            color: DefaultColorScheme.colorSets[0][0],
            shortEntityName: undefined,
            focus: new InteractionState(),
        },
        {
            seriesName: "big",
            entityName: "big",
            entityColor: undefined,
            yPoint: undefined,
            xPoint: expectedXPoints[1],
            color: DefaultColorScheme.colorSets[0][0],
            shortEntityName: undefined,
            focus: new InteractionState(),
        },
    ])

    expect(xPositions[0]).toEqual(0)
    expect(xPositions[1]).toBeCloseTo(xAxisRange * 0.4, 0)
    expect(xPositions[2]).toBeCloseTo(xAxisRange * 0.5, 0)
})

it("does not extend time range based on color column data", () => {
    // The color column has data up to 2023, but the y column only has data up to 2020.
    // The chart should not show years beyond 2020, even with tolerance.
    const csv = `year,entityName,maternalMortality,region
2018,Belarus,4,Europe
2019,Belarus,3,Europe
2020,Belarus,2,Europe
2018,Afghanistan,100,Asia
2019,Afghanistan,95,Asia
2020,Afghanistan,90,Asia
2021,Belarus,,Europe
2022,Belarus,,Europe
2023,Belarus,,Europe
2021,Afghanistan,,Asia
2022,Afghanistan,,Asia
2023,Afghanistan,,Asia`
    const table = new OwidTable(csv, [
        {
            slug: "maternalMortality",
            type: ColumnTypeNames.Numeric,
            tolerance: 5,
        },
        { slug: "region", type: ColumnTypeNames.String },
        { slug: "year", type: ColumnTypeNames.Year },
    ])

    const manager = {
        chartTypes: [GRAPHER_CHART_TYPES.Marimekko],
        table,
        selection: table.availableEntityNames,
        ySlugs: "maternalMortality",
        categoricalColorColumnSlug: "region",
        endTime: 2023,
        showNoDataArea: false,
    }
    const grapher = new GrapherState(manager)
    const chartState = new MarimekkoChartState({ manager: grapher })

    // The transformed table should not include years 2021-2023,
    // even though the color column has data for those years
    const transformedTable = chartState.transformedTable
    const years = transformedTable.timeColumn.uniqValues

    // Years should only go up to 2020 (the last year with maternalMortality data)
    expect(Math.max(...(years as number[]))).toBeLessThanOrEqual(2020)

    // The chart should show data for 2020, not 2023
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

    // xColumnSlug should be undefined because scatter is available
    expect(marimekkoState.xColumnSlug).toBeUndefined()
})
