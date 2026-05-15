import { describe, it, expect } from "vitest"
import { getMaxViews } from "./pageviews.js"

describe(getMaxViews, () => {
    it("returns 0 for empty inputs", () => {
        const views = new Map<string, number>()
        expect(getMaxViews(views, [])).toBe(0)
    })

    it("ignores missing keys", () => {
        const views = new Map([["exists", 42]])
        expect(getMaxViews(views, ["missing"])).toBe(0)
    })

    it("returns the max views across keys", () => {
        const views = new Map([
            ["a", 10],
            ["b", 25],
            ["c", 5],
        ])
        expect(getMaxViews(views, ["a", "b"])).toBe(25)
    })

    it("handles mixed present and missing keys", () => {
        const views = new Map([["a", 7]])
        expect(getMaxViews(views, ["missing", "a"])).toBe(7)
    })
})
