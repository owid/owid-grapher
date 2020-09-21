#! /usr/bin/env yarn jest

import { ScatterPlot } from "grapher/scatterCharts/ScatterPlot"
import { SynthesizeOwidTable } from "coreTable/OwidTable"

describe(ScatterPlot, () => {
    const table = SynthesizeOwidTable({
        timeRange: [2000, 2010],
        countryCount: 5,
    })
    const options = {
        table,
        yColumn: table.get("GDP"),
        xColumn: table.get("Population"),
    }

    it("can create a new chart", () => {
        const chart = new ScatterPlot({ options })
        expect(chart.failMessage).toBeTruthy()

        // table.selectAll()
        // expect(chart.getEntityNamesToShow()).toEqual(["France", "Germany"])
        // expect(chart.allPoints.length).toBeGreaterThan(5)
        // expect(chart.availableTimes).toContain(2003)
    })

    // it("can remove points outside domain", () => {
    //     const chart = new ScatterPlot({options})
    //     const count = chart.allPoints.length
    //     chart.xAxis.removePointsOutsideDomain = true
    //     chart.xAxis.max = 201
    //     expect(chart.allPoints.length).toBeGreaterThan(5)
    //     expect(chart.allPoints.length).toBeLessThan(count)
    // })
})
