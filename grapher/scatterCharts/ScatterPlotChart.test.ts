#! /usr/bin/env yarn jest

import { ScatterPlotChart } from "grapher/scatterCharts/ScatterPlotChart"
import { SynthesizeFruitTable, SynthesizeGDPTable } from "coreTable/OwidTable"
import { ScatterPlotManager } from "./ScatterPlotChartConstants"

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

// Add tests for Colors
// Add tests for relative mode
// Add tests for compare end points only
// Add tests for "Hide lines which don't cover the full span"
// Add tests for arrow charts
// Add tests for <= on log scale
// Add tests for `Don't allow values *equal* to zero for CAGR mode`
