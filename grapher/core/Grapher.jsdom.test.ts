#! /usr/bin/env yarn jest

import { Grapher } from "grapher/core/Grapher"

describe(Grapher, () => {
    it("can serialize Grapher for saving", () => {
        expect(Object.keys(new Grapher().toObject()).length).toBe(0)
    })

    it("regression fix: container options are not serialized", () => {
        const grapher = new Grapher({ xAxis: { min: 1 } })
        const obj = grapher.toObject().xAxis!
        expect(obj.max).toBe(undefined)
        expect((obj as any).containerOptions).toBe(undefined) // Regression test: should never be a containerOptions
    })

    it("can get dimension slots", () => {
        const grapher = new Grapher()
        expect(grapher.dimensionSlots.length).toBe(1)

        grapher.type = "ScatterPlot"
        expect(grapher.dimensionSlots.length).toBe(4)
    })

    it("can serialize Grapher for saving", () => {
        const grapher = new Grapher()
        const json = grapher.toObject()
        expect(Object.keys(json).length).toBe(0)
    })

    it("does not preserve defaults in the object", () => {
        const grapher = new Grapher({ tab: "chart" })
        const json = grapher.toObject()
        expect(Object.keys(json).length).toBe(0)
    })
})
