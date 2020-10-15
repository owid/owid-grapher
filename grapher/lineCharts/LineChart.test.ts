#! /usr/bin/env yarn jest

import { LineChart } from "./LineChart"
import {
    SampleColumnSlugs,
    SynthesizeFruitTableWithNonPositives,
    SynthesizeGDPTable,
} from "coreTable/OwidTableSynthesizers"
import { ChartManager } from "grapher/chart/ChartManager"
import { ScaleType } from "grapher/core/GrapherConstants"

it("can create a new chart", () => {
    const manager = {
        table: SynthesizeGDPTable({ timeRange: [2000, 2010] }),
        yColumnSlugs: [SampleColumnSlugs.GDP],
    }
    const chart = new LineChart({ manager })

    expect(chart.failMessage).toBeTruthy()

    manager.table.selectAll()

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
    ).selectAll()

    const manager: ChartManager = {
        table,
        yColumnSlugs: [SampleColumnSlugs.Fruit],
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
