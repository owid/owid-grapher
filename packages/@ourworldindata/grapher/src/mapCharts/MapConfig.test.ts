import { expect, it, describe } from "vitest"

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

it("serializes the selection", () => {
    const map = new MapConfig()
    map.selection.setSelectedEntities(["France", "Italy"])
    expect(map.toObject()).toEqual({
        selectedEntityNames: ["France", "Italy"],
    })
})

describe("globe settings", () => {
    it("doesn't serialize globe settings if the globe is inactive", () => {
        const map = new MapConfig()
        map.globe = { isActive: false, rotation: [-10, 40], zoom: 2.5 }
        expect(map.toObject()).toEqual({})
    })

    it("persists rotation as [lat, lon] (instead of the internally used [lon, lat])", () => {
        const map = new MapConfig()
        map.globe = {
            isActive: true,
            rotation: [-10, 50], // [lon, lat]
            zoom: 1,
        }
        expect(map.toObject()).toEqual({
            globe: { isActive: true, rotation: [50, -10], zoom: 1 },
        })
    })

    it("rounds coordinates and zoom to two decimal points", () => {
        const map = new MapConfig()
        map.globe = {
            isActive: true,
            rotation: [-9.3604528, 30.6320211],
            zoom: 2.72544,
        }
        expect(map.toObject()).toEqual({
            globe: { isActive: true, rotation: [30.63, -9.36], zoom: 2.73 },
        })
    })
})

describe("parsing start and end time", () => {
    it("defaults to the latest time point if start and end time are not provided", () => {
        const map = new MapConfig({})
        expect(map.startTime).toEqual(Infinity)
        expect(map.time).toEqual(Infinity)
    })

    it("defaults to the given end time if no start time is provided", () => {
        const map = new MapConfig({ time: 2000 })
        expect(map.startTime).toEqual(2000)
        expect(map.time).toEqual(2000)
    })

    it("respects the start time if provided", () => {
        const map = new MapConfig({ startTime: 2000, time: 2020 })
        expect(map.startTime).toEqual(2000)
        expect(map.time).toEqual(2020)
    })

    it("respects the start time if provided", () => {
        const map = new MapConfig({ startTime: 2000 })
        expect(map.startTime).toEqual(2000)
        expect(map.time).toEqual(Infinity)
    })
})
