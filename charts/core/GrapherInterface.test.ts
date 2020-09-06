#! /usr/bin/env yarn jest

import { PersistableGrapher } from "charts/core/GrapherInterface"

describe(PersistableGrapher, () => {
    it("can serialize Grapher for saving", () => {
        const script = new PersistableGrapher()
        const json = script.toObject()
        expect(Object.keys(json).length).toBe(0) // todo: this should be 0!
    })
})
