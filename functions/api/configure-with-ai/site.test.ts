import { beforeEach, describe, expect, it, vi } from "vitest"
import { ChartRecordType } from "@ourworldindata/types"
import { searchCharts, searchPages } from "../search/searchApi.js"
import {
    configuredUrl,
    FoundPage,
    sanitizeSiteReply,
    SiteSearch,
} from "./site.js"
import { buildPrompt, ChartContext, SanitizedReply } from "./viewfinder.js"

vi.mock(import("../search/searchApi.js"), () => ({
    searchCharts: vi.fn(),
    searchPages: vi.fn(),
}))

const lifeExpVsGdp = {
    type: ChartRecordType.Chart,
    title: "Life expectancy vs. GDP per capita",
    slug: "life-expectancy-vs-gdp-per-capita",
    subtitle: "GDP per capita is adjusted for inflation.",
    variantName: "",
    availableEntities: ["Germany", "France", "World"],
    availableTabs: ["Table", "ScatterPlot", "WorldMap"],
    url: "/grapher/life-expectancy-vs-gdp-per-capita",
}
const giniExplorerView = {
    type: ChartRecordType.ExplorerView,
    title: "Gini coefficient",
    containerTitle: "Inequality Data Explorer",
    slug: "inequality",
    queryParams: "?Indicator=Gini",
    variantName: "After tax",
    availableEntities: ["Germany", "Brazil"],
    availableTabs: ["Table", "LineChart"],
    url: "/explorers/inequality?Indicator=Gini",
}
const article = {
    type: "article",
    title: "Life expectancy",
    slug: "life-expectancy",
    content: "How has life expectancy changed over time?",
    thumbnailUrl: "https://ourworldindata.org/images/le.png",
    url: "/life-expectancy",
}

beforeEach(() => {
    vi.mocked(searchCharts).mockResolvedValue({
        query: "",
        results: [lifeExpVsGdp, giniExplorerView],
        nbHits: 2,
        page: 0,
        nbPages: 1,
        hitsPerPage: 8,
    } as never)
    vi.mocked(searchPages).mockResolvedValue({
        query: "",
        results: [article],
        nbHits: 1,
        offset: 0,
        length: 4,
    })
})

describe(SiteSearch, () => {
    it("describes results with ids, tabs as query params and country coverage", async () => {
        const search = new SiteSearch({ appId: "a", apiKey: "k" })
        const result = await search.run({
            query: "life expectancy gdp",
            countries: ["germany", "Brazil"],
        })
        expect(result).toEqual({
            charts: [
                {
                    id: "c1",
                    kind: "chart",
                    title: "Life expectancy vs. GDP per capita",
                    subtitle: "GDP per capita is adjusted for inflation.",
                    tabs: ["table", "scatter", "map"],
                    countries: 3,
                    has: { germany: true, Brazil: false },
                },
                {
                    id: "c2",
                    kind: "data explorer view",
                    title: "Gini coefficient",
                    page: "Inequality Data Explorer",
                    variant: "After tax",
                    tabs: ["table", "line"],
                    countries: 2,
                    has: { germany: true, Brazil: true },
                },
            ],
            writing: [
                {
                    id: "w1",
                    kind: "article",
                    title: "Life expectancy",
                    excerpt: "How has life expectancy changed over time?",
                },
            ],
        })
        // Searching again finds the same pages under the same ids
        await search.run({ query: "life expectancy" })
        expect([...search.found.keys()]).toEqual(["c1", "c2", "w1"])
        expect(search.searches).toEqual([
            "life expectancy gdp",
            "life expectancy",
        ])
    })
})

describe(configuredUrl, () => {
    it("adds the tab, countries and time, and keeps an explorer view's params", () => {
        expect(
            configuredUrl("/explorers/inequality?Indicator=Gini", {
                tab: "line",
                entities: ["Germany", "Brazil"],
                time: "2000..2020",
            })
        ).toBe(
            "/explorers/inequality?Indicator=Gini&tab=line&time=2000..2020&country=DEU~BRA"
        )
    })
})

const viewsReply = (views: SanitizedReply["views"]): SanitizedReply => ({
    interpretation: "Life expectancy and GDP",
    searchQuery: null,
    views,
    dropped: [],
})

const lineView = {
    label: "Line chart",
    note: null,
    closestMatch: false,
    facts: null,
    tab: "line",
    entities: [],
    time: null,
    mapRegion: null,
    tableSort: null,
    tableFilter: null,
}

describe(sanitizeSiteReply, () => {
    let found: Map<string, FoundPage>
    beforeEach(async () => {
        const search = new SiteSearch({ appId: "a", apiKey: "k" })
        await search.run({ query: "life expectancy gdp" })
        found = search.found
    })

    it("builds links from pages the searches found and drops what they don't have", () => {
        const result = sanitizeSiteReply(
            {
                intent: "elsewhere",
                message: " This chart has no GDP data. ",
                pages: [
                    {
                        id: "c1",
                        label: "Scatter, Germany and France",
                        why: "Plots both.",
                        tab: "scatter",
                        entities: ["germany", "France", "Atlantis"],
                        time: "2020",
                    },
                    {
                        id: "w1",
                        label: "Article",
                        tab: "map",
                        entities: ["France"],
                    },
                    { id: "c9", label: "Made up" },
                ],
            },
            viewsReply([]),
            found
        )
        expect(result.intent).toBe("elsewhere")
        expect(result.message).toBe("This chart has no GDP data.")
        expect(result.pages.map((p) => [p.kind, p.url, p.tab])).toEqual([
            [
                "chart",
                "/grapher/life-expectancy-vs-gdp-per-capita?tab=scatter&time=2020&country=DEU~FRA",
                "scatter",
            ],
            // Writing gets no chart settings
            ["article", "/life-expectancy", null],
        ])
        expect(result.dropped).toEqual([
            'entity "Atlantis" on /grapher/life-expectancy-vs-gdp-per-capita',
            'page id "c9"',
        ])
    })

    it("answers here when no suggested page survives, and elsewhere when no view does", () => {
        const noPages = sanitizeSiteReply(
            { intent: "elsewhere", pages: [{ id: "c9" }] },
            viewsReply([lineView]),
            found
        )
        expect(noPages.intent).toBe("here")
        expect(noPages.views).toHaveLength(1)

        const noViews = sanitizeSiteReply(
            { intent: "here", pages: [{ id: "w1" }] },
            viewsReply([]),
            found
        )
        expect(noViews.intent).toBe("elsewhere")

        // An answer elsewhere doesn't also change this chart
        const both = sanitizeSiteReply(
            { intent: "elsewhere", pages: [{ id: "w1" }] },
            viewsReply([lineView]),
            found
        )
        expect(both.views).toEqual([])
    })
})

describe("the site-mode prompt", () => {
    const ctx = {
        title: "Life expectancy",
        subtitle: "",
        indicatorName: "Life expectancy",
        seriesName: "Life expectancy",
        tolerance: 0,
        tabs: ["table", "map", "line"],
        currentTab: "line",
        selected: [],
        currentTime: null,
        mapTolerance: 0,
        columnTolerance: 0,
        canSelectEntities: true,
        data: { entities: [], series: new Map(), minYear: 1950, maxYear: 2023 },
    } satisfies ChartContext

    it("adds the pages and leaves the page-mode prompt as it was", () => {
        const page = buildPrompt(ctx, "gdp")
        const site = buildPrompt(ctx, "gdp", { site: true })
        expect(site.cached).toContain("## Beyond this chart")
        expect(site.cached).toContain('"intent": "here"|"elsewhere"')
        expect(site.cached).not.toContain('"searchQuery"')
        expect(page.cached).not.toContain("Beyond this chart")
        expect(page.cached).toContain('"searchQuery"')
        expect(site.request).toBe(page.request)
    })
})
