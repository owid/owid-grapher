#! /usr/bin/env yarn jest

import { ScatterPlotChart } from "grapher/scatterCharts/ScatterPlotChart"
import { SynthesizeGDPTable } from "coreTable/OwidTable"

it("can create a new chart", () => {
    const manager = {
        table: SynthesizeGDPTable(),
    }
    const chart = new ScatterPlotChart({ manager })
    expect(chart.failMessage).toBeFalsy()
    expect(chart.getEntityNamesToShow().length).toEqual(2)
    expect(chart.series.length).toEqual(2)
})

// it("can remove points outside domain", () => {
//     const chart = new ScatterPlot({options})
//     const count = chart.allPoints.length
//     chart.xAxis.removePointsOutsideDomain = true
//     chart.xAxis.max = 201
//     expect(chart.allPoints.length).toBeGreaterThan(5)
//     expect(chart.allPoints.length).toBeLessThan(count)
// })
