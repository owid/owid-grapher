import { expect, it, test } from "vitest"

import * as _ from "lodash-es"
import { Bounds, ColumnTypeNames } from "@ourworldindata/utils"
import {
    OwidTable,
    SampleColumnSlugs,
    SynthesizeGDPTable,
} from "@ourworldindata/core-table"
import { DefaultColorScheme } from "../color/CustomSchemes"
import { GrapherState } from "../core/Grapher"
import { GRAPHER_CHART_TYPES, SortBy, SortOrder } from "@ourworldindata/types"
import { MarimekkoChart } from "./MarimekkoChart"
import {
    BarShape,
    Item,
    MarimekkoChartManager,
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
    //expect(chart.errorInfo.reason).toBeTruthy()

    // selection.addToSelection(table.sampleEntityName(5))
    expect(chartState.errorInfo.reason).toEqual("")
    expect(chartState.series.length).toEqual(1)
    expect(chartState.series[0].points.length).toEqual(5)
    expect(chartState.xSeries!.points.length).toEqual(5)
    expect(chart.placedItems.length).toEqual(5)
    //expect(chart.placedItems)
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
    expect(chartState.series.length).toEqual(1)
    expect(chartState.series[0].points.length).toEqual(3)
    // Y series points should be one series in order of the data
    const expectedYPoints = [
        {
            position: "medium",
            value: 4,
            valueOffset: 0,
            time: 2001,
        },
        {
            position: "big",
            value: 8,
            valueOffset: 0,
            time: 2001,
        },
        {
            position: "small",
            value: 3,
            valueOffset: 0,
            time: 2001,
        },
    ]
    // X series points should be in order of the data
    const expectedXPoints = [
        { value: 4000, entity: "medium", time: 2001 },
        { value: 5000, entity: "big", time: 2001 },
        { value: 1000, entity: "small", time: 2001 },
    ]
    expect(chartState.series[0].points).toEqual(expectedYPoints)
    expect(chartState.xSeries!.points).toEqual(expectedXPoints)

    const placedItemsWithoutXPosition = chart.placedItems.map((placedItem) =>
        _.omit(placedItem, "xPosition")
    )
    const xPositions = chart.placedItems.map(
        (placedItem) => placedItem.xPosition
    )

    // placedItems should be in default sort order
    expect(placedItemsWithoutXPosition).toEqual([
        {
            entityName: "big",
            entityColor: undefined,
            bars: [
                {
                    kind: BarShape.Bar,
                    color: DefaultColorScheme.colorSets[0][0],
                    seriesName: "percentBelow2USD",
                    columnSlug: "percentBelow2USD",
                    yPoint: expectedYPoints[1],
                },
            ],
            xPoint: expectedXPoints[1],
            shortEntityName: undefined,
            focus: new InteractionState(),
        },
        {
            entityName: "medium",
            entityColor: undefined,
            bars: [
                {
                    kind: BarShape.Bar,
                    color: DefaultColorScheme.colorSets[0][0],
                    seriesName: "percentBelow2USD",
                    columnSlug: "percentBelow2USD",
                    yPoint: expectedYPoints[0],
                },
            ],
            xPoint: expectedXPoints[0],
            shortEntityName: undefined,
            focus: new InteractionState(),
        },
        {
            entityName: "small",
            entityColor: undefined,
            bars: [
                {
                    kind: BarShape.Bar,
                    color: DefaultColorScheme.colorSets[0][0],
                    seriesName: "percentBelow2USD",
                    columnSlug: "percentBelow2USD",
                    yPoint: expectedYPoints[2],
                },
            ],
            xPoint: expectedXPoints[2],
            shortEntityName: undefined,
            focus: new InteractionState(),
        },
    ])

    expect(xPositions[0]).toEqual(0)
    expect(xPositions[1]).toBeCloseTo(xAxisRange * 0.5, 0)
    expect(xPositions[2]).toBeCloseTo(xAxisRange * 0.9, 0)
})

it("can display two time series stacked correctly", () => {
    const csv = `year,entityName,population,percentBelow2USD,percentBelow10USD
2001,medium,4000,4,8.5
2001,big,5000,8,20
2001,small,1000,3,5`
    const table = new OwidTable(csv, [
        { slug: "population", type: ColumnTypeNames.Numeric },
        { slug: "percentBelow2USD", type: ColumnTypeNames.Numeric },
        { slug: "percentBelow10USD", type: ColumnTypeNames.Numeric },
        { slug: "year", type: ColumnTypeNames.Year },
    ])

    const manager: MarimekkoChartManager = {
        table,
        selection: table.availableEntityNames,
        yColumnSlugs: ["percentBelow2USD", "percentBelow10USD"],
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
    expect(chartState.series.length).toEqual(2)
    expect(chartState.series[0].points.length).toEqual(3)
    expect(chartState.series[1].points.length).toEqual(3)
    // Y series points should be one series in order of the data
    const expectedYPointsFirstSeries = [
        {
            position: "medium",
            value: 4,
            valueOffset: 0,
            time: 2001,
        },
        {
            position: "big",
            value: 8,
            valueOffset: 0,
            time: 2001,
        },
        {
            position: "small",
            value: 3,
            valueOffset: 0,
            time: 2001,
        },
    ]
    const expectedYPointsSecondSeries = [
        {
            position: "medium",
            value: 8.5,
            valueOffset: 4,
            time: 2001,
        },
        {
            position: "big",
            value: 20,
            valueOffset: 8,
            time: 2001,
        },
        {
            position: "small",
            value: 5,
            valueOffset: 3,
            time: 2001,
        },
    ]
    // X series points should be in order of the data
    const expectedXPoints = [
        { value: 4000, entity: "medium", time: 2001 },
        { value: 5000, entity: "big", time: 2001 },
        { value: 1000, entity: "small", time: 2001 },
    ]
    expect(chartState.series[0].points).toEqual(expectedYPointsFirstSeries)
    expect(chartState.series[1].points).toEqual(expectedYPointsSecondSeries)
    expect(chartState.xSeries!.points).toEqual(expectedXPoints)

    const placedItemsWithoutXPosition = chart.placedItems.map((placedItem) =>
        _.omit(placedItem, "xPosition")
    )
    const xPositions = chart.placedItems.map(
        (placedItem) => placedItem.xPosition
    )

    // placedItems should be in default sort order
    expect(placedItemsWithoutXPosition).toEqual([
        {
            entityName: "big",
            entityColor: undefined,
            bars: [
                {
                    kind: BarShape.Bar,
                    color: DefaultColorScheme.colorSets[0][0],
                    seriesName: "percentBelow2USD",
                    columnSlug: "percentBelow2USD",
                    yPoint: expectedYPointsFirstSeries[1],
                },
                {
                    kind: BarShape.Bar,
                    color: DefaultColorScheme.colorSets[0][1],
                    seriesName: "percentBelow10USD",
                    columnSlug: "percentBelow10USD",
                    yPoint: expectedYPointsSecondSeries[1],
                },
            ],
            xPoint: expectedXPoints[1],
            shortEntityName: undefined,
            focus: new InteractionState(),
        },
        {
            entityName: "medium",
            entityColor: undefined,
            bars: [
                {
                    kind: BarShape.Bar,
                    color: DefaultColorScheme.colorSets[0][0],
                    seriesName: "percentBelow2USD",
                    columnSlug: "percentBelow2USD",
                    yPoint: expectedYPointsFirstSeries[0],
                },
                {
                    kind: BarShape.Bar,
                    color: DefaultColorScheme.colorSets[0][1],
                    seriesName: "percentBelow10USD",
                    columnSlug: "percentBelow10USD",
                    yPoint: expectedYPointsSecondSeries[0],
                },
            ],
            xPoint: expectedXPoints[0],
            shortEntityName: undefined,
            focus: new InteractionState(),
        },
        {
            entityName: "small",
            entityColor: undefined,
            bars: [
                {
                    kind: BarShape.Bar,
                    color: DefaultColorScheme.colorSets[0][0],
                    seriesName: "percentBelow2USD",
                    columnSlug: "percentBelow2USD",
                    yPoint: expectedYPointsFirstSeries[2],
                },
                {
                    kind: BarShape.Bar,
                    color: DefaultColorScheme.colorSets[0][1],
                    seriesName: "percentBelow10USD",
                    columnSlug: "percentBelow10USD",
                    yPoint: expectedYPointsSecondSeries[2],
                },
            ],
            xPoint: expectedXPoints[2],
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
    expect(chartState.series.length).toEqual(1)
    expect(chartState.series[0].points.length).toEqual(3)
    // Y series points should be one series in order of the data
    const expectedYPoints = [
        {
            position: "AA",
            value: 4,
            valueOffset: 0,
            time: 2001,
        },
        {
            position: "BB",
            value: 8,
            valueOffset: 0,
            time: 2001,
        },
        {
            position: "CC",
            value: 3,
            valueOffset: 0,
            time: 2001,
        },
    ]
    // X series points should be in order of the data
    const expectedXPoints = [
        { value: 4000, entity: "AA", time: 2001 },
        { value: 5000, entity: "BB", time: 2001 },
        { value: 1000, entity: "CC", time: 2001 },
    ]
    expect(chartState.series[0].points).toEqual(expectedYPoints)
    expect(chartState.xSeries!.points).toEqual(expectedXPoints)
    // placedItems should be in default sort order
    const items = new Map<string, Item>([
        [
            "big",
            {
                entityName: "BB",
                entityColor: undefined,
                bars: [
                    {
                        kind: BarShape.Bar,
                        color: DefaultColorScheme.colorSets[0][0],
                        seriesName: "percentBelow2USD",
                        columnSlug: "percentBelow2USD",
                        yPoint: expectedYPoints[1],
                    },
                ],
                xPoint: expectedXPoints[1],
                focus: new InteractionState(),
            },
        ],
        [
            "medium",
            {
                entityName: "AA",
                entityColor: undefined,
                bars: [
                    {
                        kind: BarShape.Bar,
                        color: DefaultColorScheme.colorSets[0][0],
                        seriesName: "percentBelow2USD",
                        columnSlug: "percentBelow2USD",
                        yPoint: expectedYPoints[0],
                    },
                ],
                xPoint: expectedXPoints[0],
                focus: new InteractionState(),
            },
        ],
        [
            "small",
            {
                entityName: "CC",
                entityColor: undefined,
                bars: [
                    {
                        kind: BarShape.Bar,
                        color: DefaultColorScheme.colorSets[0][0],
                        seriesName: "percentBelow2USD",
                        columnSlug: "percentBelow2USD",
                        yPoint: expectedYPoints[2],
                    },
                ],
                xPoint: expectedXPoints[2],
                focus: new InteractionState(),
            },
        ],
    ])
    expect(chartState.sortedItems).toEqual([
        items.get("small"),
        items.get("medium"),
        items.get("big"),
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
    expect(chartState.sortedItems).toEqual([
        items.get("small"),
        items.get("medium"),
        items.get("big"),
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
    expect(chartState.sortedItems).toEqual([
        items.get("medium"),
        items.get("big"),
        items.get("small"),
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
    //grapher.startHandleTimeBound = 2000

    expect(chartState.errorInfo.reason).toEqual("")
    expect(chartState.series.length).toEqual(1)
    expect(chartState.series[0].points.length).toEqual(3)
    // Y series points should be one series in order of the data
    const expectedYPoints = [
        {
            position: "medium",
            value: 4,
            valueOffset: 0,
            time: 2001,
        },
        {
            position: "big",
            value: 8,
            valueOffset: 0,
            time: 2001,
        },
        {
            position: "small",
            value: 3,
            valueOffset: 0,
            time: 2001,
        },
    ]
    // X series points should be in order of the data
    const expectedXPoints = [
        { value: 4000, entity: "medium", time: 2001 },
        { value: 5000, entity: "big", time: 2001 },
        { value: 1000, entity: "small", time: 2001 },
    ]
    expect(chartState.series[0].points).toEqual(expectedYPoints)
    expect(chartState.xSeries!.points).toEqual(expectedXPoints)

    const placedItemsWithoutXPosition = chart.placedItems.map((placedItem) =>
        _.omit(placedItem, "xPosition")
    )
    const xPositions = chart.placedItems.map(
        (placedItem) => placedItem.xPosition
    )

    // placedItems should be in default sort order
    expect(placedItemsWithoutXPosition).toEqual([
        {
            entityName: "big",
            entityColor: undefined,
            bars: [
                {
                    kind: BarShape.Bar,
                    color: DefaultColorScheme.colorSets[0][0],
                    seriesName: "percentBelow2USD",
                    columnSlug: "percentBelow2USD",
                    yPoint: expectedYPoints[1],
                },
            ],
            xPoint: expectedXPoints[1],
            shortEntityName: undefined,
            focus: new InteractionState(),
        },
        {
            entityName: "medium",
            entityColor: undefined,
            bars: [
                {
                    kind: BarShape.Bar,
                    color: DefaultColorScheme.colorSets[0][0],
                    seriesName: "percentBelow2USD",
                    columnSlug: "percentBelow2USD",
                    yPoint: expectedYPoints[0],
                },
            ],
            xPoint: expectedXPoints[0],
            shortEntityName: undefined,
            focus: new InteractionState(),
        },
        {
            entityName: "small",
            entityColor: undefined,
            bars: [
                {
                    kind: BarShape.Bar,
                    color: DefaultColorScheme.colorSets[0][0],
                    seriesName: "percentBelow2USD",
                    columnSlug: "percentBelow2USD",
                    yPoint: expectedYPoints[2],
                },
            ],
            xPoint: expectedXPoints[2],
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
    expect(chartState.series.length).toEqual(1)
    expect(chartState.series[0].points.length).toEqual(2)
    // Y series points should be one series in order of the data. Medium should be missing here
    const expectedYPoints = [
        {
            position: "big",
            value: 8,
            valueOffset: 0,
            time: 2001,
        },
        {
            position: "small",
            value: 3,
            valueOffset: 0,
            time: 2001,
        },
    ]
    // X series points should be in order of the data
    const expectedXPoints = [
        { value: 4000, entity: "medium", time: 2001 },
        { value: 5000, entity: "big", time: 2001 },
        { value: 1000, entity: "small", time: 2001 },
    ]
    expect(chartState.series[0].points).toEqual(expectedYPoints)
    expect(chartState.xSeries!.points).toEqual(expectedXPoints)

    const placedItemsWithoutXPosition = chart.placedItems.map((placedItem) =>
        _.omit(placedItem, "xPosition")
    )
    const xPositions = chart.placedItems.map(
        (placedItem) => placedItem.xPosition
    )

    // placedItems should be in default sort order
    expect(placedItemsWithoutXPosition).toEqual([
        {
            entityName: "big",
            entityColor: undefined,
            bars: [
                {
                    kind: BarShape.Bar,
                    color: DefaultColorScheme.colorSets[0][0],
                    seriesName: "percentBelow2USD",
                    columnSlug: "percentBelow2USD",
                    yPoint: expectedYPoints[0],
                },
            ],
            xPoint: expectedXPoints[1],
            shortEntityName: undefined,
            focus: new InteractionState(),
        },
        {
            entityName: "small",
            entityColor: undefined,
            bars: [
                {
                    kind: BarShape.Bar,
                    color: DefaultColorScheme.colorSets[0][0],
                    seriesName: "percentBelow2USD",
                    columnSlug: "percentBelow2USD",
                    yPoint: expectedYPoints[1],
                },
            ],
            xPoint: expectedXPoints[2],
            shortEntityName: undefined,
            focus: new InteractionState(),
        },
        {
            entityName: "medium",
            entityColor: undefined,
            bars: [],
            xPoint: expectedXPoints[0],
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
    expect(chartState.series.length).toEqual(1)
    expect(chartState.series[0].points.length).toEqual(3)
    // Y series points should be one series in order of the data
    const expectedYPoints = [
        {
            position: "big",
            value: 8,
            valueOffset: 0,
            time: 2001,
        },
        {
            position: "medium",
            value: 4,
            valueOffset: 0,
            time: 2001,
        },

        {
            position: "small",
            value: 2,
            valueOffset: 0,
            time: 2000,
        },
    ]
    // X series points should be in order of the data
    const expectedXPoints = [
        { value: 5000, entity: "big", time: 2000 },
        { value: 4000, entity: "medium", time: 2001 },
        { value: 1000, entity: "small", time: 2001 },
    ]
    expect(chartState.series[0].points).toEqual(expectedYPoints)
    expect(chartState.xSeries!.points).toEqual(expectedXPoints)

    const placedItemsWithoutXPosition = chart.placedItems.map((placedItem) =>
        _.omit(placedItem, "xPosition")
    )
    const xPositions = chart.placedItems.map(
        (placedItem) => placedItem.xPosition
    )

    // placedItems should be in default sort order
    expect(placedItemsWithoutXPosition).toEqual([
        {
            entityName: "big",
            entityColor: undefined,
            bars: [
                {
                    kind: BarShape.Bar,
                    color: DefaultColorScheme.colorSets[0][0],
                    seriesName: "percentBelow2USD",
                    columnSlug: "percentBelow2USD",
                    yPoint: expectedYPoints[0],
                },
            ],
            xPoint: expectedXPoints[0],
            shortEntityName: undefined,
            focus: new InteractionState(),
        },
        {
            entityName: "medium",
            entityColor: undefined,
            bars: [
                {
                    kind: BarShape.Bar,
                    color: DefaultColorScheme.colorSets[0][0],
                    seriesName: "percentBelow2USD",
                    columnSlug: "percentBelow2USD",
                    yPoint: expectedYPoints[1],
                },
            ],
            xPoint: expectedXPoints[1],
            shortEntityName: undefined,
            focus: new InteractionState(),
        },
        {
            entityName: "small",
            entityColor: undefined,
            bars: [
                {
                    kind: BarShape.Bar,
                    color: DefaultColorScheme.colorSets[0][0],
                    seriesName: "percentBelow2USD",
                    columnSlug: "percentBelow2USD",
                    yPoint: expectedYPoints[2],
                },
            ],
            xPoint: expectedXPoints[2],
            shortEntityName: undefined,
            focus: new InteractionState(),
        },
    ])

    expect(xPositions[0]).toEqual(0)
    expect(xPositions[1]).toBeCloseTo(xAxisRange * 0.5, 0)
    expect(xPositions[2]).toBeCloseTo(xAxisRange * 0.9, 0)
})

it("can deal with y columns with missing values", () => {
    const csv = `year,entityName,population,percentBelow2USD,percentBelow10USD
2000,medium,4000,,10
2000,big,5000,10,20
2000,small,800,2,4
2001,medium,4000,4,8
2001,big,5000,8,
2001,small,1000,3,6`
    const table = new OwidTable(csv, [
        { slug: "population", type: ColumnTypeNames.Numeric },
        { slug: "percentBelow2USD", type: ColumnTypeNames.Numeric },
        { slug: "percentBelow10USD", type: ColumnTypeNames.Numeric },
        { slug: "year", type: ColumnTypeNames.Year },
    ])

    // TODO: why is it ySlugs and xSlug here instead of yColumnSlugs and xColumnSlug? Unify when we have config migrations?
    const manager = {
        chartTypes: [GRAPHER_CHART_TYPES.Marimekko],
        table,
        selection: table.availableEntityNames,
        ySlugs: "percentBelow2USD percentBelow10USD",
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
    //grapher.startHandleTimeBound = 2000

    expect(chartState.errorInfo.reason).toEqual("")
    expect(chartState.series.length).toEqual(2)
    expect(chartState.series[0].points.length).toEqual(3)
    expect(chartState.series[1].points.length).toEqual(2)
    // Y series points should be one series in order of the data
    const expectedYPoints1 = [
        {
            position: "medium",
            value: 4,
            valueOffset: 0,
            time: 2001,
        },
        {
            position: "big",
            value: 8,
            valueOffset: 0,
            time: 2001,
        },
        {
            position: "small",
            value: 3,
            valueOffset: 0,
            time: 2001,
        },
    ]
    const expectedYPoints2 = [
        {
            position: "medium",
            value: 8,
            valueOffset: 4,
            time: 2001,
        },

        {
            position: "small",
            value: 6,
            valueOffset: 3,
            time: 2001,
        },
    ]
    // X series points should be in order of the data
    const expectedXPoints = [
        { value: 4000, entity: "medium", time: 2001 },
        { value: 5000, entity: "big", time: 2001 },
        { value: 1000, entity: "small", time: 2001 },
    ]
    expect(chartState.series[0].points).toEqual(expectedYPoints1)
    expect(chartState.series[1].points).toEqual(expectedYPoints2)
    expect(chartState.xSeries!.points).toEqual(expectedXPoints)

    const placedItemsWithoutXPosition = chart.placedItems.map((placedItem) =>
        _.omit(placedItem, "xPosition")
    )
    const xPositions = chart.placedItems.map(
        (placedItem) => placedItem.xPosition
    )
    // placedItems should be in default sort order
    expect(placedItemsWithoutXPosition).toEqual([
        {
            entityName: "medium",
            entityColor: undefined,
            bars: [
                {
                    kind: BarShape.Bar,
                    color: DefaultColorScheme.colorSets[0][0],
                    seriesName: "percentBelow2USD",
                    columnSlug: "percentBelow2USD",
                    yPoint: expectedYPoints1[0],
                },
                {
                    kind: BarShape.Bar,
                    color: DefaultColorScheme.colorSets[0][1],
                    seriesName: "percentBelow10USD",
                    columnSlug: "percentBelow10USD",
                    yPoint: expectedYPoints2[0],
                },
            ],
            xPoint: expectedXPoints[0],
            shortEntityName: undefined,
            focus: new InteractionState(),
        },
        {
            entityName: "small",
            entityColor: undefined,
            bars: [
                {
                    kind: BarShape.Bar,
                    color: DefaultColorScheme.colorSets[0][0],
                    seriesName: "percentBelow2USD",
                    columnSlug: "percentBelow2USD",
                    yPoint: expectedYPoints1[2],
                },
                {
                    kind: BarShape.Bar,
                    color: DefaultColorScheme.colorSets[0][1],
                    seriesName: "percentBelow10USD",
                    columnSlug: "percentBelow10USD",
                    yPoint: expectedYPoints2[1],
                },
            ],
            xPoint: expectedXPoints[2],
            shortEntityName: undefined,
            focus: new InteractionState(),
        },
        {
            entityName: "big",
            entityColor: undefined,
            bars: [
                {
                    kind: BarShape.Bar,
                    color: DefaultColorScheme.colorSets[0][0],
                    seriesName: "percentBelow2USD",
                    columnSlug: "percentBelow2USD",
                    yPoint: expectedYPoints1[1],
                },
            ],
            xPoint: expectedXPoints[1],
            shortEntityName: undefined,
            focus: new InteractionState(),
        },
    ])

    expect(xPositions[0]).toEqual(0)
    expect(xPositions[1]).toBeCloseTo(xAxisRange * 0.4, 0)
    expect(xPositions[2]).toBeCloseTo(xAxisRange * 0.5, 0)
})
