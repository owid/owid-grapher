import { expect, it } from "vitest"

import { MapConfig } from "./MapConfig"
import { MapRegionName } from "@ourworldindata/types"

it("can serialize for saving", () => {
    expect(new MapConfig().toObject()).toEqual({})

    const map = new MapConfig()
    map.hideTimeline = true
    map.region = MapRegionName.Africa
    expect(map.toObject()).toEqual({
        hideTimeline: true,
        region: "Africa",
    })
})
