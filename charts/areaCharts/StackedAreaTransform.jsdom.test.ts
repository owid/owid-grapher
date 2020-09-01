#! /usr/bin/env yarn jest

import { StackedAreaTransform } from "./StackedAreaTransform"
import { basicGdpChart } from "charts/test/samples"

describe(StackedAreaTransform, () => {
    it("can create a new transform and toggle relative mode", () => {
        const chart = basicGdpChart()
        const transform = new StackedAreaTransform(chart)
        expect(transform.isValidConfig).toEqual(true)
        expect(transform.yAxis.domain[1]).toBeGreaterThan(100)

        chart.props.stackMode = "relative"
        expect(transform.yAxis.domain).toEqual([0, 100])
    })
})
