import { expect, it, describe } from "vitest"
import {
    chartsSource,
    datasetsSource,
    fallbackSection,
    gdocsSource,
    indicatorsSource,
    multiDimsSource,
    PALETTE_SOURCES,
    rankResults,
    usersSource,
} from "./paletteSources.js"

describe("source mappers", () => {
    it("maps a chart to an edit action, adding a view-on-site secondary when published", () => {
        const published = chartsSource.toPaletteItem(
            {
                id: 42,
                title: "Life expectancy",
                slug: "life-expectancy",
                isPublished: true,
            },
            chartsSource.icon
        )
        expect(published.id).toBe("charts:42")
        expect(published.title).toBe("Life expectancy")
        expect(published.subtitle).toBe("life-expectancy")
        expect(published.actions).toEqual([
            { label: "Edit", to: "/charts/42/edit" },
            {
                label: "View on site",
                href: "/grapher/life-expectancy",
                external: true,
            },
        ])
    })

    it("omits the view-on-site action for unpublished charts", () => {
        const draft = chartsSource.toPaletteItem(
            { id: 7, title: "Draft", slug: "draft", isPublished: false },
            chartsSource.icon
        )
        expect(draft.actions).toHaveLength(1)
    })

    it("falls back to slug then id for a chart with no title", () => {
        expect(
            chartsSource.toPaletteItem(
                { id: 9, slug: "only-slug" },
                chartsSource.icon
            ).title
        ).toBe("only-slug")
        expect(
            chartsSource.toPaletteItem({ id: 9 }, chartsSource.icon).title
        ).toBe("Chart 9")
    })

    it("searches charts on title, slug and variant name", () => {
        expect(
            chartsSource.searchKeys({
                id: 1,
                title: "T",
                slug: "s",
                variantName: "v",
            })
        ).toEqual(["T", "s", "v"])
    })

    it("routes gdocs to their preview page and includes authors in search keys", () => {
        const item = gdocsSource.toPaletteItem(
            {
                id: "abc",
                title: "CO2 explained",
                slug: "co2",
                type: "article",
                authors: ["Ada"],
            },
            gdocsSource.icon
        )
        expect(item.actions).toEqual([
            { label: "Open", to: "/gdocs/abc/preview" },
        ])
        expect(item.subtitle).toBe("article · co2")
        expect(
            gdocsSource.searchKeys({ id: "abc", title: "T", authors: ["Ada"] })
        ).toEqual(["T", "Ada"])
    })

    it("skips null and undefined search keys", () => {
        expect(
            usersSource.searchKeys({ id: 1, fullName: "Ada", email: undefined })
        ).toEqual(["Ada"])
        expect(
            datasetsSource.searchKeys({ id: 1, name: "D", namespace: undefined })
        ).toEqual(["D"])
    })

    it("only offers a view-on-site action for multi-dims with a slug", () => {
        expect(
            multiDimsSource.toPaletteItem(
                { id: 1, title: "M", slug: null },
                multiDimsSource.icon
            ).actions
        ).toHaveLength(1)
        expect(
            multiDimsSource.toPaletteItem(
                { id: 1, title: "M", slug: "m" },
                multiDimsSource.icon
            ).actions
        ).toHaveLength(2)
    })

    it("gives every source a unique id and item ids namespaced by source", () => {
        const ids = PALETTE_SOURCES.map((source) => source.id)
        expect(new Set(ids).size).toBe(ids.length)
        expect(
            chartsSource.toPaletteItem({ id: 1 }, chartsSource.icon).id
        ).toMatch(/^charts:/)
    })
})

describe(rankResults, () => {
    const charts = [
        { id: 1, title: "Life expectancy", slug: "life-expectancy" },
        { id: 2, title: "Life expectancy at age 10", slug: "le-10" },
        { id: 3, title: "Child mortality", slug: "child-mortality" },
    ]

    it("returns nothing for an empty query", () => {
        expect(rankResults({ data: { charts }, query: "" })).toEqual({
            sections: [],
        })
    })

    it("matches fuzzily and labels the section by source", () => {
        const { sections } = rankResults({
            data: { charts },
            query: "lifexp",
        })
        expect(sections).toHaveLength(1)
        expect(sections[0].label).toBe("Charts")
        expect(sections[0].items.map((i) => i.id)).toContain("charts:1")
    })

    it("skips sources that have no rows loaded", () => {
        const { sections } = rankResults({
            data: { charts: [], datasets: undefined },
            query: "life",
        })
        expect(sections).toEqual([])
    })

    it("keeps sections in fixed source order regardless of score", () => {
        const { sections } = rankResults({
            data: {
                users: [{ id: 1, fullName: "life" }],
                charts,
            },
            query: "life",
        })
        // charts precedes users in PALETTE_SOURCES
        expect(sections.map((s) => s.id)).toEqual(["charts", "users"])
    })

    it("caps hits per source at 5", () => {
        const manyCharts = Array.from({ length: 12 }, (_, index) => ({
            id: index,
            title: `Population ${index}`,
            slug: `pop-${index}`,
        }))
        const { sections } = rankResults({
            data: { charts: manyCharts },
            query: "population",
        })
        expect(sections[0].items).toHaveLength(5)
    })

    it("hoists a single exact match into a top hit and removes it from its section", () => {
        const { topHit, sections } = rankResults({
            data: { charts },
            query: "Child mortality",
        })
        expect(topHit?.id).toBe("charts:3")
        expect(
            sections.flatMap((s) => s.items).map((i) => i.id)
        ).not.toContain("charts:3")
    })

    it("does not hoist when several matches are exact or prefix matches", () => {
        const { topHit } = rankResults({
            data: { charts },
            query: "Life expectancy",
        })
        expect(topHit).toBeUndefined()
    })

    it("passes server-searched sources through without fuzzy filtering", () => {
        const { sections } = rankResults({
            data: {
                indicators: [
                    { id: 1, name: "totally unrelated", dataset: "ds" },
                ],
            },
            query: "gdp",
            preSearchedSourceIds: ["indicators"],
        })
        expect(sections[0].id).toBe("indicators")
        expect(sections[0].items[0].id).toBe("indicators:1")
    })

    it("de-duplicates rows matched via several keys", () => {
        // matches on both title and slug, but must appear only once (here as
        // the hoisted top hit, since it is an exact match)
        const { topHit, sections } = rankResults({
            data: { charts: [{ id: 1, title: "co2", slug: "co2" }] },
            query: "co2",
        })
        expect(topHit?.id).toBe("charts:1")
        expect(sections).toEqual([])
    })

    it("de-duplicates multi-key matches that are not hoisted", () => {
        const { sections } = rankResults({
            data: {
                charts: [
                    { id: 1, title: "co2 emissions", slug: "co2-emissions" },
                    { id: 2, title: "co2 per capita", slug: "co2-per-capita" },
                ],
            },
            query: "co2",
        })
        expect(sections[0].items.map((i) => i.id)).toEqual([
            "charts:1",
            "charts:2",
        ])
    })
})

describe(fallbackSection, () => {
    it("offers index-page searches for sources that define a fallback", () => {
        const section = fallbackSection("solar panels")
        expect(section?.label).toBe("Search instead in")
        const ids = section?.items.map((item) => item.id)
        expect(ids).toEqual(["fallback:charts", "fallback:indicators"])
    })

    it("URL-encodes the query into the index page's search param", () => {
        const section = fallbackSection("solar panels")
        const chartsFallback = section?.items[0]
        expect(chartsFallback?.actions[0]).toEqual({
            label: "Search",
            to: "/charts?chartSearch=solar%20panels",
        })
    })

    it("returns nothing for an empty query", () => {
        expect(fallbackSection("")).toBeUndefined()
    })

    it("returns nothing when no source offers a fallback", () => {
        expect(fallbackSection("q", [indicatorsSource])?.items).toHaveLength(1)
        expect(fallbackSection("q", [usersSource])).toBeUndefined()
    })
})
