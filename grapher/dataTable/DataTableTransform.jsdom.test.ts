#! /usr/bin/env yarn jest

import { DataTableTransform } from "./DataTableTransform"
import { basicGdpGrapher } from "grapher/test/samples"

describe(DataTableTransform, () => {
    it("can create a new transform and toggle relative mode", () => {
        const grapher = basicGdpGrapher()
        const transform = new DataTableTransform(grapher)
        expect(transform.isValidConfig).toEqual(true)
    })
})
