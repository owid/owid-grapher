#! /usr/bin/env jest

import { Bounds } from "../../clientUtils/Bounds"
import { SortOrder, SortBy } from "../../clientUtils/owidTypes"
import { ColumnTypeNames } from "../../coreTable/CoreColumnDef"
import { OwidTable } from "../../coreTable/OwidTable"
import {
    SampleColumnSlugs,
    SynthesizeGDPTable,
} from "../../coreTable/OwidTableSynthesizers"
import { MarimekkoChart } from "./MarimekkoChart"
import {
    MarimekkoChartManager,
    BarShape,
    Item,
    PlacedItem,
} from "./MarimekkoChartConstants"

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

    const chart = new MarimekkoChart({ manager })
    //expect(chart.failMessage).toBeTruthy()

    // selection.addToSelection(table.sampleEntityName(5))
    expect(chart.failMessage).toEqual("")
    expect(chart.series.length).toEqual(1)
    expect(chart.series[0].points.length).toEqual(5)
    expect(chart.xSeries.points.length).toEqual(5)
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
    const chart = new MarimekkoChart({
        manager,
        bounds: new Bounds(0, 0, 1000, 1000),
    })
    const xAxisRange = chart["dualAxis"].horizontalAxis.rangeSize

    expect(chart.failMessage).toEqual("")
    expect(chart.series.length).toEqual(1)
    expect(chart.series[0].points.length).toEqual(3)
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
    expect(chart.series[0].points).toEqual(expectedYPoints)
    expect(chart.xSeries.points).toEqual(expectedXPoints)
    // placedItems should be in default sort order
    expect(chart.placedItems.map(roundXPosition)).toEqual([
        {
            entityName: "big",
            entityColor: undefined,
            bars: [
                {
                    kind: BarShape.Bar,
                    color: "#3C4E66",
                    seriesName: "percentBelow2USD",
                    yPoint: expectedYPoints[1],
                },
            ],
            xPoint: expectedXPoints[1],
            xPosition: 0,
        },
        {
            entityName: "medium",
            entityColor: undefined,
            bars: [
                {
                    kind: BarShape.Bar,
                    color: "#3C4E66",
                    seriesName: "percentBelow2USD",
                    yPoint: expectedYPoints[0],
                },
            ],
            xPoint: expectedXPoints[0],
            xPosition: Math.round(xAxisRange * 0.5),
        },
        {
            entityName: "small",
            entityColor: undefined,
            bars: [
                {
                    kind: BarShape.Bar,
                    color: "#3C4E66",
                    seriesName: "percentBelow2USD",
                    yPoint: expectedYPoints[2],
                },
            ],
            xPoint: expectedXPoints[2],
            xPosition: Math.round(xAxisRange * 0.9),
        },
    ])
})

function roundXPosition(item: PlacedItem): PlacedItem {
    return {
        ...item,
        xPosition: Math.round(item.xPosition),
    }
}

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
    const chart = new MarimekkoChart({
        manager,
        bounds: new Bounds(0, 0, 1000, 1000),
    })
    const xAxisRange = chart["dualAxis"].horizontalAxis.rangeSize

    expect(chart.failMessage).toEqual("")
    expect(chart.series.length).toEqual(2)
    expect(chart.series[0].points.length).toEqual(3)
    expect(chart.series[1].points.length).toEqual(3)
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
    expect(chart.series[0].points).toEqual(expectedYPointsFirstSeries)
    expect(chart.series[1].points).toEqual(expectedYPointsSecondSeries)
    expect(chart.xSeries.points).toEqual(expectedXPoints)
    // placedItems should be in default sort order
    expect(chart.placedItems.map(roundXPosition)).toEqual([
        {
            entityName: "big",
            entityColor: undefined,
            bars: [
                {
                    kind: BarShape.Bar,
                    color: "#3C4E66",
                    seriesName: "percentBelow2USD",
                    yPoint: expectedYPointsFirstSeries[1],
                },
                {
                    kind: BarShape.Bar,
                    color: "#B13507",
                    seriesName: "percentBelow10USD",
                    yPoint: expectedYPointsSecondSeries[1],
                },
            ],
            xPoint: expectedXPoints[1],
            xPosition: 0,
        },
        {
            entityName: "medium",
            entityColor: undefined,
            bars: [
                {
                    kind: BarShape.Bar,
                    color: "#3C4E66",
                    seriesName: "percentBelow2USD",
                    yPoint: expectedYPointsFirstSeries[0],
                },
                {
                    kind: BarShape.Bar,
                    color: "#B13507",
                    seriesName: "percentBelow10USD",
                    yPoint: expectedYPointsSecondSeries[0],
                },
            ],
            xPoint: expectedXPoints[0],
            xPosition: Math.round(xAxisRange * 0.5),
        },
        {
            entityName: "small",
            entityColor: undefined,
            bars: [
                {
                    kind: BarShape.Bar,
                    color: "#3C4E66",
                    seriesName: "percentBelow2USD",
                    yPoint: expectedYPointsFirstSeries[2],
                },
                {
                    kind: BarShape.Bar,
                    color: "#B13507",
                    seriesName: "percentBelow10USD",
                    yPoint: expectedYPointsSecondSeries[2],
                },
            ],
            xPoint: expectedXPoints[2],
            xPosition: Math.round(xAxisRange * 0.9),
        },
    ])
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
    let chart = new MarimekkoChart({
        manager: {
            ...manager,
            sortConfig: {
                sortBy: SortBy.total,
                sortOrder: SortOrder.asc,
            },
        },

        bounds: new Bounds(0, 0, 1000, 1000),
    })

    expect(chart.failMessage).toEqual("")
    expect(chart.series.length).toEqual(1)
    expect(chart.series[0].points.length).toEqual(3)
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
    expect(chart.series[0].points).toEqual(expectedYPoints)
    expect(chart.xSeries.points).toEqual(expectedXPoints)
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
                        color: "#3C4E66",
                        seriesName: "percentBelow2USD",
                        yPoint: expectedYPoints[1],
                    },
                ],
                xPoint: expectedXPoints[1],
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
                        color: "#3C4E66",
                        seriesName: "percentBelow2USD",
                        yPoint: expectedYPoints[0],
                    },
                ],
                xPoint: expectedXPoints[0],
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
                        color: "#3C4E66",
                        seriesName: "percentBelow2USD",
                        yPoint: expectedYPoints[2],
                    },
                ],
                xPoint: expectedXPoints[2],
            },
        ],
    ])
    expect(chart["sortedItems"]).toEqual([
        items.get("small"),
        items.get("medium"),
        items.get("big"),
    ])

    chart = new MarimekkoChart({
        manager: {
            ...manager,
            sortConfig: {
                sortBy: SortBy.column,
                sortColumnSlug: "percentBelow2USD",
                sortOrder: SortOrder.asc,
            },
        },

        bounds: new Bounds(0, 0, 1000, 1000),
    })
    expect(chart["sortedItems"]).toEqual([
        items.get("small"),
        items.get("medium"),
        items.get("big"),
    ])

    chart = new MarimekkoChart({
        manager: {
            ...manager,
            sortConfig: {
                sortBy: SortBy.entityName,
                sortOrder: SortOrder.asc,
            },
        },

        bounds: new Bounds(0, 0, 1000, 1000),
    })
    expect(chart["sortedItems"]).toEqual([
        items.get("medium"),
        items.get("big"),
        items.get("small"),
    ])
})
