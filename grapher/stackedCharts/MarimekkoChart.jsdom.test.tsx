#! /usr/bin/env jest

import { Bounds } from "../../clientUtils/Bounds"
import { ColumnTypeNames } from "../../coreTable/CoreColumnDef"
import { OwidTable } from "../../coreTable/OwidTable"
import { Grapher } from "../core/Grapher"
import { ChartTypeName } from "../core/GrapherConstants"
import { MarimekkoChart } from "./MarimekkoChart"
import { BarShape, PlacedItem } from "./MarimekkoChartConstants"
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
        type: ChartTypeName.Marimekko,
        table,
        selection: table.availableEntityNames,
        ySlugs: "percentBelow2USD",
        xSlug: "population",
        endTime: 2001,
    }
    const grapher = new Grapher(manager)
    const chart = new MarimekkoChart({
        manager: grapher,
        bounds: new Bounds(0, 0, 1000, 1000),
    })
    const xAxisRange = chart["dualAxis"].horizontalAxis.rangeSize
    //grapher.startHandleTimeBound = 2000

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
        type: ChartTypeName.Marimekko,
        table,
        selection: table.availableEntityNames,
        ySlugs: "percentBelow2USD",
        xSlug: "population",
        endTime: 2001,
    }
    const grapher = new Grapher(manager)
    const chart = new MarimekkoChart({
        manager: grapher,
        bounds: new Bounds(0, 0, 1001, 1000),
    })
    const xAxisRange = chart["dualAxis"].horizontalAxis.rangeSize

    expect(chart.failMessage).toEqual("")
    expect(chart.series.length).toEqual(1)
    expect(chart.series[0].points.length).toEqual(2)
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
                    yPoint: expectedYPoints[0],
                },
            ],
            xPoint: expectedXPoints[1],
            xPosition: 0,
        },
        {
            entityName: "small",
            entityColor: undefined,
            bars: [
                {
                    kind: BarShape.Bar,
                    color: "#3C4E66",
                    seriesName: "percentBelow2USD",
                    yPoint: expectedYPoints[1],
                },
            ],
            xPoint: expectedXPoints[2],
            xPosition: Math.round(xAxisRange * 0.5),
        },
        {
            entityName: "medium",
            entityColor: undefined,
            bars: [],
            xPoint: expectedXPoints[0],
            xPosition: Math.round(xAxisRange * 0.6),
        },
    ])
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
        type: ChartTypeName.Marimekko,
        table,
        selection: table.availableEntityNames,
        ySlugs: "percentBelow2USD",
        xSlug: "population",
        endTime: 2001,
    }
    const grapher = new Grapher(manager)
    const chart = new MarimekkoChart({
        manager: grapher,
        bounds: new Bounds(0, 0, 1000, 1000),
    })
    const xAxisRange = chart["dualAxis"].horizontalAxis.rangeSize

    expect(chart.failMessage).toEqual("")
    expect(chart.series.length).toEqual(1)
    expect(chart.series[0].points.length).toEqual(3)
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
                    yPoint: expectedYPoints[0],
                },
            ],
            xPoint: expectedXPoints[0],
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
                    yPoint: expectedYPoints[1],
                },
            ],
            xPoint: expectedXPoints[1],
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
        type: ChartTypeName.Marimekko,
        table,
        selection: table.availableEntityNames,
        ySlugs: "percentBelow2USD percentBelow10USD",
        xSlug: "population",
        endTime: 2001,
    }
    const grapher = new Grapher(manager)
    const chart = new MarimekkoChart({
        manager: grapher,
        bounds: new Bounds(0, 0, 1000, 1000),
    })
    const xAxisRange = chart["dualAxis"].horizontalAxis.rangeSize
    //grapher.startHandleTimeBound = 2000

    expect(chart.failMessage).toEqual("")
    expect(chart.series.length).toEqual(2)
    expect(chart.series[0].points.length).toEqual(3)
    expect(chart.series[1].points.length).toEqual(2)
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
    expect(chart.series[0].points).toEqual(expectedYPoints1)
    expect(chart.series[1].points).toEqual(expectedYPoints2)
    expect(chart.xSeries.points).toEqual(expectedXPoints)
    // placedItems should be in default sort order
    expect(chart.placedItems.map(roundXPosition)).toEqual([
        {
            entityName: "medium",
            entityColor: undefined,
            bars: [
                {
                    kind: BarShape.Bar,
                    color: "#3C4E66",
                    seriesName: "percentBelow2USD",
                    yPoint: expectedYPoints1[0],
                },
                {
                    kind: BarShape.Bar,
                    color: "#B13507",
                    seriesName: "percentBelow10USD",
                    yPoint: expectedYPoints2[0],
                },
            ],
            xPoint: expectedXPoints[0],
            xPosition: 0,
        },
        {
            entityName: "small",
            entityColor: undefined,
            bars: [
                {
                    kind: BarShape.Bar,
                    color: "#3C4E66",
                    seriesName: "percentBelow2USD",
                    yPoint: expectedYPoints1[2],
                },
                {
                    kind: BarShape.Bar,
                    color: "#B13507",
                    seriesName: "percentBelow10USD",
                    yPoint: expectedYPoints2[1],
                },
            ],
            xPoint: expectedXPoints[2],
            xPosition: Math.round(xAxisRange * 0.4),
        },
        {
            entityName: "big",
            entityColor: undefined,
            bars: [
                {
                    kind: BarShape.Bar,
                    color: "#3C4E66",
                    seriesName: "percentBelow2USD",
                    yPoint: expectedYPoints1[1],
                },
            ],
            xPoint: expectedXPoints[1],
            xPosition: Math.round(xAxisRange * 0.5),
        },
    ])
})

function roundXPosition(item: PlacedItem): PlacedItem {
    return {
        ...item,
        xPosition: Math.round(item.xPosition),
    }
}
