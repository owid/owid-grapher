#! /usr/bin/env yarn jest

import { GrapherScript } from "charts/core/GrapherScript"

describe(GrapherScript, () => {
    it("can serialize Grapher for saving", () => {
        const script = new GrapherScript()
        const json = script.json
        expect(Object.keys(json).length).toBe(55) // todo: this should be 0!
    })
})
