#! /usr/bin/env jest

import { MapConfig } from "./MapConfig"
import { MapProjectionName } from "./MapProjections"

it("can serialize for saving", () => {
    expect(new MapConfig().toObject()).toEqual({})

    const map = new MapConfig()
    map.hideTimeline = true
    map.projection = MapProjectionName.Africa
    expect(map.toObject()).toEqual({
        hideTimeline: true,
        projection: "Africa",
    })
})

it("works with legacy variableId", () => {
    const map = new MapConfig({ variableId: 23 })
    expect(map.columnSlug).toEqual("23")
    expect(map.toObject()).toEqual({
        variableId: 23,
    })
})
