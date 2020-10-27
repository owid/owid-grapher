#! /usr/bin/env yarn jest

import { LineChart } from "./LineChart"
import {
    SampleColumnSlugs,
    SynthesizeFruitTableWithNonPositives,
    SynthesizeGDPTable,
} from "coreTable/OwidTableSynthesizers"
import { ChartManager } from "grapher/chart/ChartManager"
import { ScaleType } from "grapher/core/GrapherConstants"
import { OwidTable } from "coreTable/OwidTable"

it("can create a new chart", () => {
    const table = SynthesizeGDPTable({ timeRange: [2000, 2010] })
    const manager: ChartManager = {
        table,
        yColumnSlugs: [SampleColumnSlugs.GDP],
    }
    const chart = new LineChart({ manager })

    expect(chart.failMessage).toBeTruthy()

    manager.selection = table.availableEntityNames

    expect(chart.failMessage).toEqual("")
    expect(chart.series.length).toEqual(2)
    expect(chart.placedSeries.length).toEqual(2)
    expect(chart.placedSeries[0].placedPoints[0].x).toBeGreaterThan(0)
})

it("can filter points with negative values when using a log scale", () => {
    const table = SynthesizeFruitTableWithNonPositives(
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
    const chart = new LineChart({ manager })
    expect(chart.series.length).toEqual(2)
    expect(chart.allPoints.length).toEqual(200)

    const logScaleManager = {
        ...manager,
        yAxisConfig: {
            scaleType: ScaleType.log,
        },
    }
    const logChart = new LineChart({ manager: logScaleManager })
    expect(logChart.verticalAxis.domain[0]).toBeGreaterThan(0)
    expect(logChart.series.length).toEqual(2)
    expect(logChart.allPoints.length).toEqual(180)
})

it("will combine entity and column name when we set multi country multi column", () => {
    const table = SynthesizeGDPTable()
    const manager = {
        table,
        selection: table.availableEntityNames,
    }
    const chart = new LineChart({ manager })
    expect(chart.series[0].seriesName).toContain(" - ")
})

it("can add custom colors", () => {
    const table = new OwidTable({
        entityName: ["usa", "canada", "usa", "canada"],
        time: [2000, 2000, 2001, 2001],
        gdp: [100, 200, 200, 300],
        entityColor: ["blue", "red", "blue", "red"],
    })
    const manager = {
        yColumnSlugs: ["gdp"],
        table,
        selection: table.availableEntityNames,
    }
    const chart = new LineChart({ manager })
    expect(chart.series.map((series) => series.color)).toEqual(["blue", "red"])
})
