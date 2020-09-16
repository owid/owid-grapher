#! /usr/bin/env yarn jest

import { Grapher } from "grapher/core/Grapher"

describe(Grapher, () => {
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

    it("an empty Grapher serializes to an empty object", () => {
        expect(new Grapher().toObject()).toEqual({})
    })

    it("does not preserve defaults in the object", () => {
        expect(new Grapher({ tab: "chart" }).toObject()).toEqual({})
    })
})
