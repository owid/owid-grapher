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

    it("uses the indicator's grapher config as-is when it carries dimensions", () => {
        const config = {
            title: "Authored",
            dimensions: [{ property: DimensionProperty.y, variableId: 42 }],
        }
        expect(makeChartConfigForIndicator(42, config)).toBe(config)
    })

    it("adds the y dimension to an indicator config that lacks one", () => {
        expect(
            makeChartConfigForIndicator(42, { title: "Authored", note: "n" })
        ).toEqual({
            title: "Authored",
            note: "n",
            dimensions: [{ property: DimensionProperty.y, variableId: 42 }],
        })
    })
})
