#! /usr/bin/env yarn jest

import { ScatterPlot } from "grapher/scatterCharts/ScatterPlot"
import { SynthesizeGDPTable } from "coreTable/OwidTable"

const table = SynthesizeGDPTable({
    timeRange: [2000, 2010],
    entityCount: 2,
})
const manager = {
    table,
    yColumnSlug: "GDP",
    xColumnSlug: "Population",
}

it("can create a new chart", () => {
    const chart = new ScatterPlot({ manager })
    expect(chart.failMessage).toBeFalsy()
    expect(chart.getEntityNamesToShow().length).toEqual(2)
    expect(chart.marks.length).toEqual(2)
    expect(chart.availableTimes).toContain(2003)
})

// it("can remove points outside domain", () => {
//     const chart = new ScatterPlot({options})
//     const count = chart.allPoints.length
//     chart.xAxis.removePointsOutsideDomain = true
//     chart.xAxis.max = 201
//     expect(chart.allPoints.length).toBeGreaterThan(5)
//     expect(chart.allPoints.length).toBeLessThan(count)
// })
