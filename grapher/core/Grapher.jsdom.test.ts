#! /usr/bin/env yarn jest

import { Grapher } from "grapher/core/Grapher"

describe(Grapher, () => {
    it("can serialize Grapher for saving", () => {
        expect(Object.keys(new Grapher().object).length).toBe(0)
    })

    it("regression fix: container options are not serialized", () => {
        const grapher = new Grapher({ xAxis: { min: 1 } })
        const obj = grapher.object.xAxis as any
        expect(obj?.max).toBe(undefined)
        expect(obj?.containerOptions).toBe(undefined)
    })
})
