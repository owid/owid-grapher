import { StackMode, TimeBoundValueStr } from "@ourworldindata/types"
import { grapherConfigToQueryParams } from "./GrapherUrl.js"

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
})
