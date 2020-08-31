#! /usr/bin/env yarn jest

import { ScatterTransform } from "charts/scatterCharts/ScatterTransform"
import { ChartConfig } from "charts/core/ChartConfig"
import { basicScatter } from "./ScatterPlot.stories"

describe(ScatterTransform, () => {
    it("can create a new transform", () => {
        const chart = new ChartConfig()
        const scatterT = new ScatterTransform(chart)
        expect(scatterT.failMessage).toEqual("Missing Y axis variable")
    })

    it("can handle relative mode", () => {
        const chartRuntime = basicScatter()
        expect(chartRuntime.scatterTransform.failMessage).toEqual(
            "Missing Y axis variable"
        )
    })
})
