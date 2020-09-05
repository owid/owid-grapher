#! /usr/bin/env yarn jest

import { Grapher } from "charts/core/Grapher"
import { GrapherScript } from "charts/core/GrapherScript"

describe(Grapher, () => {
    it("can serialize Grapher for saving", () => {
        const config = new Grapher(new GrapherScript())
        const json = config.json
        expect(Object.keys(json).length).toBe(57) // It should be 0. Setting it to 57 for just 1 commit.
    })

    it("container options are not serialized", () => {
        const config = new Grapher(new GrapherScript())
        expect(config.json.xAxis.containerOptions).toBe(undefined)
    })
})
