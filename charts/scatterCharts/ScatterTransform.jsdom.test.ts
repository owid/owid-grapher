#! /usr/bin/env yarn jest

import { ScatterTransform } from "charts/scatterCharts/ScatterTransform"
import { basicScatter } from "./ScatterPlot.tests"

describe(ScatterTransform, () => {
    it("can create a new transform", () => {
        const chart = basicScatter()
        const scatterT = new ScatterTransform(chart)
        expect(scatterT.isValidConfig).toEqual(true)
        expect(scatterT.getEntityNamesToShow()).toEqual(["France", "Germany"])
        expect(scatterT.allPoints.length).toBeGreaterThan(6)
        expect(scatterT.availableYears).toContain(2003)
    })
})
