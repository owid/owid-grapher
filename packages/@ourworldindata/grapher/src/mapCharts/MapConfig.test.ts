import { expect, it } from "vitest"

import { MapConfig } from "./MapConfig"
import { MapProjectionName } from "@ourworldindata/types"

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
