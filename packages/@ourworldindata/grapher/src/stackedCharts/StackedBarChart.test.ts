#! /usr/bin/env jest

import {
    SampleColumnSlugs,
    SynthesizeFruitTableWithStringValues,
    SynthesizeGDPTable,
    OwidTable,
    ColumnTypeNames,
} from "@ourworldindata/core-table"
import { ChartManager } from "../chart/ChartManager"
import { SelectionArray } from "../selection/SelectionArray"
import { isNumber } from "@ourworldindata/utils"
import { StackedBarChart } from "./StackedBarChart"

it("can create a chart", () => {
    const table = SynthesizeGDPTable({ timeRange: [2000, 2010] })
    const selection = new SelectionArray()
    const manager = {
        table,
        yColumnSlugs: [SampleColumnSlugs.Population],
        selection,
    }

    const chart = new StackedBarChart({ manager })
    expect(chart.failMessage).toBeTruthy()

    selection.addToSelection(table.sampleEntityName(1))
    expect(chart.failMessage).toEqual("")
    expect(chart.series[0].points.length).toEqual(10)
})

describe("stackedbar chart with columns as series", () => {
    const table = SynthesizeGDPTable()
    const manager: ChartManager = {
        table,
        selection: table.sampleEntityName(1),
        yColumnSlugs: [SampleColumnSlugs.GDP, SampleColumnSlugs.Population],
    }
    const chart = new StackedBarChart({ manager })

    it("render the legend items in the same stack order as the chart, bottom stack item on bottom of chart", () => {
        expect(chart.series.length).toEqual(2)
        // The stacking happens bottom to top, so we need to .reverse()
        expect(
            chart.series.map((series) => series.seriesName).reverse()
        ).toEqual([SampleColumnSlugs.GDP, SampleColumnSlugs.Population])
    })
})

describe("stackedbar chart with entities as series", () => {
    const table = SynthesizeGDPTable({ entityCount: 5 })
    const manager: ChartManager = {
        table,
        selection: table.availableEntityNames,
        yColumnSlugs: [SampleColumnSlugs.Population],
    }
    const chart = new StackedBarChart({ manager })

    it("can render complete data correctly", () => {
        expect(chart.series.length).toEqual(5)
        expect(chart.series[0].points[0].value).toBeTruthy()
    })

    it("can handle a missing row", () => {
        const table = SynthesizeGDPTable({ entityCount: 5 }).dropRandomRows(
            1,
            1
        )
        const manager = {
            table,
            selection: table.availableEntityNames,
            yColumnSlugs: [SampleColumnSlugs.Population],
        }
        const chart = new StackedBarChart({ manager })
        expect(chart.series.length).toEqual(5)
        expect(chart.series[0].points[0].value).toBeTruthy()
    })
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
    const chart = new StackedBarChart({ manager })
    expect(chart.series.length).toEqual(2)
    expect(
        chart.series.every((series) =>
            series.points.every(
                (point) => isNumber(point.position) && isNumber(point.value)
            )
        )
    ).toBeTruthy()
})

it("should not mark any values as interpolated by default", () => {
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

    const chart = new StackedBarChart({ manager })

    // indices are reversed because stacked charts reverse the stacking order
    const pointsFrance = chart.series[1].points
    const pointsUK = chart.series[0].points

    expect(pointsFrance[0].interpolated).toBeFalsy() // year = 2000
    expect(pointsFrance[1].interpolated).toBeFalsy() // year = 2001
    expect(pointsFrance[2].interpolated).toBeFalsy() // year = 2004
    expect(pointsFrance[3].interpolated).toBeFalsy() // year = 2005

    expect(pointsUK[0].interpolated).toBeFalsy() // year = 2000
    expect(pointsUK[1].interpolated).toBeFalsy() // year = 2001
    expect(pointsUK[2].interpolated).toBeFalsy() // year = 2004
    expect(pointsUK[3].interpolated).toBeFalsy() // year = 2005
})
