import { expect, it, describe } from "vitest"

import { StackMode, TimeBoundValueStr } from "@ourworldindata/types"
import {
    grapherConfigToQueryParams,
    grapherObjectToQueryParams,
} from "./GrapherUrl.js"
import { MapConfig } from "../mapCharts/MapConfig.js"
import { Grapher } from "./Grapher.js"

describe(grapherConfigToQueryParams, () => {
    it("should convert an empty grapher config to an empty object", () => {
        expect(grapherConfigToQueryParams({})).toEqual({})
    })

    it("time", () => {
        expect(
            grapherConfigToQueryParams({
                minTime: 2000,
            })
        ).toEqual({ time: "2000..latest" })

        expect(
            grapherConfigToQueryParams({
                maxTime: 2000,
            })
        ).toEqual({ time: "earliest..2000" })

        expect(
            grapherConfigToQueryParams({
                minTime: 2000,
                maxTime: 2000,
            })
        ).toEqual({ time: "2000" })

        expect(
            grapherConfigToQueryParams({
                minTime: TimeBoundValueStr.unboundedLeft,
                maxTime: TimeBoundValueStr.unboundedLeft,
            })
        ).toEqual({ time: "earliest" })

        expect(
            grapherConfigToQueryParams({
                minTime: 2000,
                maxTime: 2020,
            })
        ).toEqual({ time: "2000..2020" })
    })

    it("selectedEntityNames", () => {
        expect(
            grapherConfigToQueryParams({
                selectedEntityNames: ["United States"],
            })
        ).toEqual({ country: "~USA" })

        expect(
            grapherConfigToQueryParams({
                selectedEntityNames: ["United States", "France"],
            })
        ).toEqual({ country: "USA~FRA" })
    })

    it("stackMode", () => {
        expect(
            grapherConfigToQueryParams({
                stackMode: StackMode.relative,
            })
        ).toEqual({ stackMode: "relative" })
    })

    it("combines multiple settings", () => {
        expect(
            grapherConfigToQueryParams({
                minTime: 2000,
                selectedEntityNames: ["United States", "France"],
                stackMode: StackMode.relative,
            })
        ).toEqual({
            time: "2000..latest",
            country: "USA~FRA",
            stackMode: "relative",
        })
    })

    it("globe settings", () => {
        expect(grapherConfigToQueryParams({ map: new MapConfig() })).toEqual({
            region: "World",
        })

        expect(
            grapherConfigToQueryParams({
                map: new MapConfig({
                    globe: { isActive: true, rotation: [-30, 40], zoom: 2 },
                }),
            })
        ).toEqual({
            region: "World",
            globe: "1",
            globeRotation: "-30,40",
            globeZoom: "2",
        })
    })
})

describe(grapherObjectToQueryParams, () => {
    it("globe", () => {
        const queryParams = grapherObjectToQueryParams(
            new Grapher({
                map: {
                    globe: { isActive: true, rotation: [-30, 40], zoom: 2 },
                },
            })
        )

        expect(queryParams.globe).toBe("1")
        expect(queryParams.globeRotation).toBe("-30,40")
        expect(queryParams.globeZoom).toBe("2")
    })
})
