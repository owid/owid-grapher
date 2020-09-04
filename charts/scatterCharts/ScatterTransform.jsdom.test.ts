#! /usr/bin/env yarn jest

import { ScatterTransform } from "charts/scatterCharts/ScatterTransform"
import { basicScatter } from "charts/test/samples"

describe(ScatterTransform, () => {
    it("can create a new transform", () => {
        const chart = basicScatter()
        const scatterT = new ScatterTransform(chart)
        expect(scatterT.isValidConfig).toEqual(true)
        expect(scatterT.getEntityNamesToShow()).toEqual(["France", "Germany"])
        expect(scatterT.allPoints.length).toBeGreaterThan(5)
        expect(scatterT.availableYears).toContain(2003)
    })

    it("can remove points outside domain", () => {
        const chart = basicScatter()
        const scatterT = new ScatterTransform(chart)
        const count = scatterT.allPoints.length
        chart.xAxisOptions.removePointsOutsideDomain = true
        chart.xAxisOptions.max = 201
        expect(scatterT.allPoints.length).toBeGreaterThan(5)
        expect(scatterT.allPoints.length).toBeLessThan(count)
    })
})
