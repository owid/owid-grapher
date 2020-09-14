#! /usr/bin/env yarn jest

import { ScatterTransform } from "grapher/scatterCharts/ScatterTransform"
import { basicScatterGrapher } from "grapher/test/samples"

describe(ScatterTransform, () => {
    it("can create a new transform", () => {
        const chart = basicScatterGrapher()
        const scatterT = new ScatterTransform(chart)
        expect(scatterT.getEntityNamesToShow()).toEqual(["France", "Germany"])
        expect(scatterT.allPoints.length).toBeGreaterThan(5)
        expect(scatterT.availableTimes).toContain(2003)
    })

    it("can remove points outside domain", () => {
        const chart = basicScatterGrapher()
        const scatterT = new ScatterTransform(chart)
        const count = scatterT.allPoints.length
        chart.xAxis.removePointsOutsideDomain = true
        chart.xAxis.max = 201
        expect(scatterT.allPoints.length).toBeGreaterThan(5)
        expect(scatterT.allPoints.length).toBeLessThan(count)
    })
})
