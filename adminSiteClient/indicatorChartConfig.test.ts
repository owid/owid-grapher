import { describe, expect, it } from "vitest"
import { DimensionProperty } from "@ourworldindata/types"
import { makeChartConfigForIndicator } from "./indicatorChartConfig.js"

describe(makeChartConfigForIndicator, () => {
    it("builds a map of the indicator when it has no grapher config", () => {
        expect(makeChartConfigForIndicator(42, undefined)).toEqual({
            yAxis: { min: 0 },
            map: { columnSlug: "42" },
            tab: "map",
            hasMapTab: true,
            dimensions: [{ property: DimensionProperty.y, variableId: 42 }],
        })
    })

    it("keeps the dimensions an indicator config carries", () => {
        const dimensions = [{ property: DimensionProperty.y, variableId: 7 }]
        expect(
            makeChartConfigForIndicator(42, { title: "Authored", dimensions })
        ).toEqual({ title: "Authored", dimensions, hasMapTab: true })
    })

    it("adds the y dimension to an indicator config that lacks one", () => {
        expect(
            makeChartConfigForIndicator(42, { title: "Authored", note: "n" })
        ).toEqual({
            title: "Authored",
            note: "n",
            hasMapTab: true,
            dimensions: [{ property: DimensionProperty.y, variableId: 42 }],
        })
    })

    it("respects a config that opts out of the map tab", () => {
        expect(
            makeChartConfigForIndicator(42, {
                title: "Authored",
                hasMapTab: false,
            }).hasMapTab
        ).toBe(false)
    })
})
