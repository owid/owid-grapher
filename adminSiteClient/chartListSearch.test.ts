import { describe, expect, it } from "vitest"
import type { ChartListItem } from "./ChartList.js"
import { filterChartsBySearchString } from "./chartListSearch.js"

function chart(overrides: Partial<ChartListItem>): ChartListItem {
    return {
        id: 1,
        title: "",
        slug: "",
        internalNotes: "",
        variantName: "",
        isPublished: false,
        tab: undefined,
        hasMapTab: false,
        type: "LineChart",
        hasChartTab: true,
        lastEditedAt: "",
        lastEditedBy: "",
        publishedAt: "",
        publishedBy: "",
        tags: [],
        grapherViewsPerDay: 0,
        narrativeChartsCount: 0,
        referencesCount: 0,
        ...overrides,
    }
}

const charts = [
    chart({ id: 1, title: "CO2 emissions per capita", slug: "co-emissions" }),
    chart({
        id: 2,
        title: "Life expectancy",
        tags: [{ id: 10, name: "Health" }],
        hasMapTab: true,
    }),
    chart({ id: 3, title: "Solar energy share", lastEditedBy: "Ada" }),
]

describe(filterChartsBySearchString, () => {
    it("returns everything for an empty search", () => {
        expect(filterChartsBySearchString(charts, "")).toBe(charts)
        expect(filterChartsBySearchString(charts, undefined)).toBe(charts)
    })

    it("matches words in any order across the searched fields", () => {
        expect(
            filterChartsBySearchString(charts, "capita emissions").map(
                (c) => c.id
            )
        ).toEqual([1])
        expect(
            filterChartsBySearchString(charts, "health").map((c) => c.id)
        ).toEqual([2])
        expect(
            filterChartsBySearchString(charts, "ada").map((c) => c.id)
        ).toEqual([3])
        expect(
            filterChartsBySearchString(charts, "map").map((c) => c.id)
        ).toEqual([2])
        expect(
            filterChartsBySearchString(charts, "3").map((c) => c.id)
        ).toEqual([3])
    })

    it("supports quoted phrases and exclusion", () => {
        expect(
            filterChartsBySearchString(charts, '"energy share"').map(
                (c) => c.id
            )
        ).toEqual([3])
        expect(
            filterChartsBySearchString(charts, '"share energy"').map(
                (c) => c.id
            )
        ).toEqual([])
        expect(
            filterChartsBySearchString(charts, "linechart -solar").map(
                (c) => c.id
            )
        ).toEqual([1, 2])
    })
})
