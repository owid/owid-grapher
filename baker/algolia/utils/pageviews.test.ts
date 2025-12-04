import { describe, it, expect } from "vitest"
import { getMaxViews7d } from "./pageviews.js"

describe(getMaxViews7d, () => {
    it("returns 0 for empty inputs", () => {
        const pageviews = {}
        expect(getMaxViews7d(pageviews, [])).toBe(0)
    })

    it("ignores missing urls", () => {
        const pageviews = {
            "/grapher/exists": { views_7d: 42 },
        }
        expect(getMaxViews7d(pageviews, ["/grapher/missing"])).toBe(0)
    })

    it("returns the max views across urls", () => {
        const pageviews = {
            "/grapher/a": { views_7d: 10 },
            "/grapher/b": { views_7d: 25 },
            "/grapher/c": { views_7d: 5 },
        }
        expect(getMaxViews7d(pageviews, ["/grapher/a", "/grapher/b"])).toBe(25)
    })

    it("handles mixed present and missing urls", () => {
        const pageviews = {
            "/grapher/a": { views_7d: 7 },
        }
        expect(
            getMaxViews7d(pageviews, ["/grapher/missing", "/grapher/a"])
        ).toBe(7)
    })
})
