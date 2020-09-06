#! /usr/bin/env yarn jest

import { Grapher } from "charts/core/Grapher"

describe(Grapher, () => {
    it("can serialize Grapher for saving", () => {
        const config = new Grapher()
        const json = config.object
        expect(Object.keys(json).length).toBe(57) // todo: this should be 0!
    })

    it("container options are not serialized", () => {
        const config = new Grapher()
        expect(config.object.xAxis.containerOptions).toBe(undefined)
    })
})
