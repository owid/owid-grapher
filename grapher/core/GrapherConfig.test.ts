#! /usr/bin/env yarn jest

import { PersistableGrapher } from "grapher/core/GrapherConfig"

describe(PersistableGrapher, () => {
    it("can serialize Grapher for saving", () => {
        const script = new PersistableGrapher()
        const json = script.toObject()
        expect(Object.keys(json).length).toBe(0)
    })

    it("does not preserve defaults in the object", () => {
        const script = new PersistableGrapher({ tab: "chart" })
        const json = script.toObject()
        expect(Object.keys(json).length).toBe(0)
    })
})
