import * as _ from "lodash-es"
import { expect, it, describe } from "vitest"

import {
    SampleColumnSlugs,
    SynthesizeFruitTableWithStringValues,
    SynthesizeGDPTable,
    OwidTable,
} from "@ourworldindata/core-table"
import { ChartManager } from "../chart/ChartManager"
import { SelectionArray } from "../selection/SelectionArray"
import { StackedBarChartState } from "./StackedBarChartState.js"
import { numericDefs, yearDef } from "../testData/columnDefs.js"

function makeStackedBarChart(
    table: OwidTable,
    config: Partial<ChartManager> = {}
): StackedBarChartState {
    const manager: ChartManager = {
        table,
        selection: table.availableEntityNames,
        ...config,
    }
    return new StackedBarChartState({ manager })
}

it("can create a chart", () => {
    const table = SynthesizeGDPTable({ timeRange: [2000, 2010] })
    const selection = new SelectionArray()
    const chartState = makeStackedBarChart(table, {
        yColumnSlugs: [SampleColumnSlugs.Population],
        selection,
    })
    expect(chartState.errorInfo.reason).toBeTruthy()

    selection.addToSelection(table.sampleEntityName(1))
    expect(chartState.errorInfo.reason).toEqual("")
    expect(chartState.series[0].points.length).toEqual(10)
})

describe("stackedbar chart with columns as series", () => {
    const table = SynthesizeGDPTable()
    const chartState = makeStackedBarChart(table, {
        selection: table.sampleEntityName(1),
        yColumnSlugs: [SampleColumnSlugs.GDP, SampleColumnSlugs.Population],
    })

    it("render the legend items in the same stack order as the chart, bottom stack item on bottom of chart", () => {
        expect(chartState.series.length).toEqual(2)
        // The stacking happens bottom to top, so we need to .reverse()
        expect(
            chartState.series.map((series) => series.seriesName).toReversed()
        ).toEqual([SampleColumnSlugs.GDP, SampleColumnSlugs.Population])
    })
})

describe("stackedbar chart with entities as series", () => {
    const table = SynthesizeGDPTable({ entityCount: 5 })
    const chartState = makeStackedBarChart(table, {
        yColumnSlugs: [SampleColumnSlugs.Population],
    })

    it("can render complete data correctly", () => {
        expect(chartState.series.length).toEqual(5)
        expect(chartState.series[0].points[0].value).toBeTruthy()
    })

    it("can handle a missing row", () => {
        const table = SynthesizeGDPTable({ entityCount: 5 }).dropRowsAt([2])
        const chartState = makeStackedBarChart(table, {
            yColumnSlugs: [SampleColumnSlugs.Population],
        })
        expect(chartState.series.length).toEqual(5)
        expect(chartState.series[0].points[0].value).toBeTruthy()
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
    const chartState = makeStackedBarChart(table, {
        yColumnSlugs: [SampleColumnSlugs.Fruit],
    })
    expect(chartState.series.length).toEqual(2)
    expect(
        chartState.series.every((series) =>
            series.points.every(
                (point) => _.isNumber(point.position) && _.isNumber(point.value)
            )
        )
    ).toBeTruthy()
})

it("should not mark any values as interpolated by default", () => {
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

    const chartState = makeStackedBarChart(table, { yColumnSlugs: ["gdp"] })

    // Indices are reversed because stacked charts reverse the stacking order
    const pointsFrance = chartState.series[1].points
    const pointsUK = chartState.series[0].points

    expect(pointsFrance.map((p) => [p.position, !!p.interpolated])).toEqual([
        [2000, false],
        [2001, false],
        [2002, false],
        [2003, false],
        [2004, false],
        [2005, false],
    ])
    expect(pointsUK.map((p) => [p.position, !!p.interpolated])).toEqual([
        [2000, false],
        [2001, false],
        [2002, false],
        [2003, false],
        [2004, false],
        [2005, false],
    ])
})
