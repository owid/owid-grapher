#! /usr/bin/env yarn jest

import { SlopeChartTransform } from "./SlopeChartTransform"
import { basicGdpGrapher } from "grapher/test/samples"

describe(SlopeChartTransform, () => {
    it("can create a new transform and toggle relative mode", () => {
        const grapher = basicGdpGrapher()
        const transform = new SlopeChartTransform(grapher)
        expect(transform.isValidConfig).toEqual(true)
    })
})
