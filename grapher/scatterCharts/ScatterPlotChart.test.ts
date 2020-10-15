#! /usr/bin/env yarn jest

import { ScatterPlotChart } from "grapher/scatterCharts/ScatterPlotChart"
import {
    SampleColumnSlugs,
    SynthesizeFruitTable,
    SynthesizeFruitTableWithNonPositives,
    SynthesizeGDPTable,
} from "coreTable/OwidTableSynthesizers"
import { ScatterPlotManager } from "./ScatterPlotChartConstants"
import { ScaleType } from "grapher/core/GrapherConstants"

it("can create a new chart", () => {
    const manager: ScatterPlotManager = {
        table: SynthesizeGDPTable(),
    }

    const chart = new ScatterPlotChart({ manager })
    expect(chart.failMessage).toBeFalsy()
    expect(chart.getSeriesNamesToShow().size).toEqual(2)
    expect(chart.series.length).toEqual(2)
    expect(chart.allPoints.length).toBeGreaterThan(0)
})

it("can remove points outside domain", () => {
    const manager: ScatterPlotManager = {
        table: SynthesizeFruitTable(undefined, 2),
    }
    const chart = new ScatterPlotChart({ manager })
    const initialCount = chart.allPoints.length
    manager.xAxisConfig = { removePointsOutsideDomain: true, max: 1100 }
    expect(chart.allPoints.length).toBeGreaterThan(0)
    expect(chart.allPoints.length).toBeLessThan(initialCount)
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

    const manager: ScatterPlotManager = {
        table,
        yColumnSlug: SampleColumnSlugs.Fruit,
        xColumnSlug: SampleColumnSlugs.Vegetables,
        yAxisConfig: {},
        xAxisConfig: {},
    }

    const chart = new ScatterPlotChart({ manager })
    expect(chart.series.length).toEqual(2)
    expect(chart.allPoints.length).toEqual(200)

    const logScaleManager = {
        ...manager,
        yAxisConfig: {
            scaleType: ScaleType.log,
        },
        xAxisConfig: {
            scaleType: ScaleType.log,
        },
    }
    const logChart = new ScatterPlotChart({ manager: logScaleManager })
    expect(logChart.dualAxis.horizontalAxis.domain[0]).toBeGreaterThan(0)
    expect(logChart.dualAxis.verticalAxis.domain[0]).toBeGreaterThan(0)
    expect(logChart.series.length).toEqual(2)
    expect(logChart.allPoints.length).toEqual(180)
})

// Add tests for Colors
// Add tests for relative mode
// Add tests for compare end points only
// Add tests for "Hide lines which don't cover the full span"
// Add tests for arrow charts
// Add tests for `Don't allow values *equal* to zero for CAGR mode`
