#! /usr/bin/env yarn jest

import { DiscreteBarTransform } from "./DiscreteBarTransform"
import { basicGdpGrapher } from "grapher/test/samples"

describe(DiscreteBarTransform, () => {
    it("can create a new transform and toggle relative mode", () => {
        const grapher = basicGdpGrapher()
        const transform = new DiscreteBarTransform(grapher)
        expect(!!transform).toEqual(true)
    })
})
