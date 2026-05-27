import { describe, it, expect } from "vitest"
import { getMaxChartViews } from "./pageviews.js"
import { AnalyticsChartViewsType, ChartViewsMap } from "@ourworldindata/types"

describe(getMaxChartViews, () => {
    function makeTestChartViewsMap(
        entries: [AnalyticsChartViewsType, string, number][] = []
    ): ChartViewsMap {
        return entries.reduce(
            (acc, [type, id, views]) => {
                acc[type].set(id, views)
                return acc
            },
            {
                grapher_chart: new Map<string, number>(),
                explorer: new Map<string, number>(),
                multidim: new Map<string, number>(),
            }
        )
    }
    it("returns 0 for empty inputs", () => {
        const emptyViews = makeTestChartViewsMap()
        expect(getMaxChartViews(emptyViews, [])).toBe(0)
    })

    it("ignores missing keys", () => {
        const views = makeTestChartViewsMap([
            ["grapher_chart", "chart-slug-1", 10],
            ["explorer", "view-config-uuid-1", 20],
        ])

        expect(
            getMaxChartViews(views, [{ type: "multidim", id: "missing" }])
        ).toBe(0)
    })

    it("returns the max views across keys", () => {
        const views = makeTestChartViewsMap([
            ["grapher_chart", "chart-slug-1", 10],
            ["grapher_chart", "chart-slug-2", 25],
            ["explorer", "view-config-uuid-1", 100],
        ])
        expect(
            getMaxChartViews(views, [
                { type: "grapher_chart", id: "chart-slug-1" },
                { type: "grapher_chart", id: "chart-slug-2" },
            ])
        ).toBe(25)
    })

    it("handles mixed present and missing keys", () => {
        const views = makeTestChartViewsMap([
            ["grapher_chart", "chart-slug-1", 7],
        ])
        expect(
            getMaxChartViews(views, [
                { type: "grapher_chart", id: "missing-chart-slug-1" },
                { type: "grapher_chart", id: "chart-slug-1" },
            ])
        ).toBe(7)
    })
})
