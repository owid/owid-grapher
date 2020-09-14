#! /usr/bin/env yarn jest

import { StackedBarTransform } from "./StackedBarTransform"
import { basicGdpGrapher } from "grapher/test/samples"

describe(StackedBarTransform, () => {
    it("can create a new transform and toggle relative mode", () => {
        const grapher = basicGdpGrapher()
        const transform = new StackedBarTransform(grapher)
        expect(!!transform).toEqual(true)
    })
})
