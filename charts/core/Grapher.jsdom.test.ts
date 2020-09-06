#! /usr/bin/env yarn jest

import { Grapher } from "charts/core/Grapher"

describe(Grapher, () => {
    it("can serialize Grapher for saving", () => {
        expect(Object.keys(new Grapher().object).length).toBe(57) // todo: this should be 0!
    })

    it("regression fix: container options are not serialized", () => {
        const config = new Grapher({ xAxis: { min: 1 } })
        const obj = config.object.xAxis as any
        expect(obj?.containerOptions).toBe(undefined)
    })
})
