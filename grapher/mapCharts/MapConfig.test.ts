#! /usr/bin/env yarn jest

import { PersistableMapConfig } from "./MapConfig"

describe(PersistableMapConfig, () => {
    it("can serialize for saving", () => {
        expect(Object.keys(new PersistableMapConfig().toObject()).length).toBe(
            0
        )

        const map = new PersistableMapConfig()
        map.hideTimeline = true
        map.projection = "Africa"
        expect(map.toObject()).toEqual({
            hideTimeline: true,
            projection: "Africa",
        })
    })

    it("works with legacy variableId", () => {
        const map = new PersistableMapConfig({ variableId: 23 })
        expect(map.columnSlug).toEqual("23")
        expect(map.toObject()).toEqual({
            variableId: 23,
        })
    })
})
