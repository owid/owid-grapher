import { describe, it, expect } from "vitest"
import { getMaxChartViews } from "./pageviews.js"

describe(getMaxChartViews, () => {
    it("returns 0 for empty inputs", () => {
        const views = new Map<string, number>()
        expect(getMaxChartViews(views, [])).toBe(0)
    })

    it("ignores missing keys", () => {
        const views = new Map([["exists", 42]])
        expect(getMaxChartViews(views, ["missing"])).toBe(0)
    })

    it("returns the max views across keys", () => {
        const views = new Map([
            ["a", 10],
            ["b", 25],
            ["c", 5],
        ])
        expect(getMaxChartViews(views, ["a", "b"])).toBe(25)
    })

    it("handles mixed present and missing keys", () => {
        const views = new Map([["a", 7]])
        expect(getMaxChartViews(views, ["missing", "a"])).toBe(7)
    })
})
