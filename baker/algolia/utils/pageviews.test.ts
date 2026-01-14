import { describe, it, expect } from "vitest"
import { getMaxViews7d, PageviewsByUrl } from "./pageviews.js"

function makePageviews(
    data: Record<string, number>
): PageviewsByUrl {
    const result: PageviewsByUrl = {}
    for (const [url, views_7d] of Object.entries(data)) {
        result[url] = { views_7d, views_14d: 0, views_365d: 0 }
    }
    return result
}

describe(getMaxViews7d, () => {
    it("returns 0 for empty inputs", () => {
        const pageviews = {}
        expect(getMaxViews7d(pageviews, [])).toBe(0)
    })

    it("ignores missing urls", () => {
        const pageviews = makePageviews({
            "/grapher/exists": 42,
        })
        expect(getMaxViews7d(pageviews, ["/grapher/missing"])).toBe(0)
    })

    it("returns the max views across urls", () => {
        const pageviews = makePageviews({
            "/grapher/a": 10,
            "/grapher/b": 25,
            "/grapher/c": 5,
        })
        expect(getMaxViews7d(pageviews, ["/grapher/a", "/grapher/b"])).toBe(25)
    })

    it("handles mixed present and missing urls", () => {
        const pageviews = makePageviews({
            "/grapher/a": 7,
        })
        expect(
            getMaxViews7d(pageviews, ["/grapher/missing", "/grapher/a"])
        ).toBe(7)
    })
})
