import { describe, expect, it } from "vitest"

import type { ChartListItem } from "./ChartList.js"
import {
    searchableChart,
    SearchableChart,
    chartSearchFilter,
    chartSearchWordsToHighlight,
    countNames,
    getFacetValues,
    hasChartFilters,
    setFacetValues,
    splitOffCurrentTerm,
    suggestChartSearchTerms,
} from "./chartSearchQuery.js"

function chart(
    id: number,
    overrides: Partial<ChartListItem> = {}
): ChartListItem {
    return {
        id,
        configId: `config-${id}`,
        title: `Chart ${id}`,
        slug: `chart-${id}`,
        internalNotes: undefined,
        variantName: undefined,
        isPublished: true,
        tab: undefined,
        hasMapTab: false,
        type: "LineChart",
        hasChartTab: true,
        lastEditedAt: "2026-10-01T00:00:00Z",
        lastEditedBy: "Ada Lovelace",
        publishedAt: "2026-01-01T00:00:00Z",
        publishedBy: "Ada Lovelace",
        tags: [],
        grapherViewsPerDay: 0,
        narrativeChartsCount: 0,
        referencesCount: 0,
        etlConfigCatalogPath: null,
        isEtlManaged: false,
        etlOverriddenFields: null,
        etlSlug: null,
        ...overrides,
    }
}

const tag = (name: string): ChartListItem["tags"][number] => ({
    id: name.length,
    name,
})

const etl = (overriddenFields: string[] = []): Partial<ChartListItem> => ({
    isEtlManaged: true,
    etlConfigCatalogPath: "grapher/ns/latest/ds#chart",
    etlOverriddenFields: JSON.stringify(overriddenFields),
})

const CHARTS = [
    chart(1, { title: "Energy use", tags: [tag("Energy")] }),
    chart(2, { isPublished: false, tags: [tag("Energy Mix")], ...etl() }),
    chart(3, { tags: [tag("Health")], ...etl(["title"]) }),
    chart(4, {
        tags: [tag("Life Expectancy"), tag("Space Exploration")],
        isPublished: false,
        publishedAt: "",
        publishedBy: "",
        lastEditedBy: "Grace Hopper",
        lastEditedAt: "2025-06-01T00:00:00Z",
    }),
]

function ids(query: string, charts = CHARTS): number[] {
    const filter = chartSearchFilter(query, charts, searchableChart)
    return charts.filter(filter).map((c) => c.id!)
}

describe(chartSearchFilter, () => {
    it("searches plain words in titles, slugs, ids, tags and people", () => {
        expect(ids("energy")).toEqual([1, 2])
        expect(ids("grace")).toEqual([4])
        expect(ids("-energy")).toEqual([3, 4])
    })

    it("reads is: as status and source", () => {
        expect(ids("is:draft")).toEqual([2, 4])
        expect(ids("is:published")).toEqual([1, 3])
        expect(ids("is:etl")).toEqual([2, 3])
        expect(ids("is:drifted")).toEqual([3])
        expect(ids("is:admin")).toEqual([1, 4])
    })

    it("ORs terms of one facet", () => {
        expect(ids("tag:Energy tag:Health")).toEqual([1, 3])
        expect(ids("is:draft is:published")).toEqual([1, 2, 3, 4])
    })

    it("ANDs status and source, though both are is: terms", () => {
        expect(ids("is:draft is:etl")).toEqual([2])
    })

    it("excludes with a minus", () => {
        expect(ids("-is:draft")).toEqual([1, 3])
        expect(ids("is:etl -tag:Health")).toEqual([2])
    })

    it("matches a known tag by its whole name only", () => {
        expect(ids("tag:energy")).toEqual([1])
        expect(ids('tag:"Energy Mix"')).toEqual([2])
    })

    it("matches a tag by its start while it is being typed", () => {
        expect(ids("tag:ener")).toEqual([1, 2])
    })

    it("matches an author as last editor or publisher", () => {
        expect(ids('author:"Ada Lovelace"')).toEqual([1, 2, 3])
        expect(ids("author:grace")).toEqual([4])
    })

    it("narrows nothing on a term that isn't finished or isn't valid", () => {
        for (const query of ["tag:", "is:", "is:dra", "author:"])
            expect(ids(query)).toEqual([1, 2, 3, 4])
    })

    it("searches an unknown field as text", () => {
        const withUrl = [chart(5, { internalNotes: "see https://x.org" })]
        expect(ids("https://x.org", withUrl)).toEqual([5])
    })
})

describe("the filter controls' rewrites", () => {
    const query = 'grid is:draft tag:"Energy Mix" "solar power"'

    it("read a facet's included values", () => {
        expect(getFacetValues(query, "status")).toEqual(["draft"])
        expect(getFacetValues(query, "source")).toEqual([])
        expect(getFacetValues(query, "tag")).toEqual(["Energy Mix"])
        expect(getFacetValues("-tag:Health", "tag")).toEqual([])
    })

    it("replace only their own facet and keep the rest in order", () => {
        expect(setFacetValues(query, "tag", ["Health", "Energy Mix"])).toBe(
            'grid is:draft "solar power" tag:Health tag:"Energy Mix"'
        )
        expect(setFacetValues(query, "status", [])).toBe(
            'grid tag:"Energy Mix" "solar power"'
        )
    })

    it("leave the status term alone when setting the source", () => {
        expect(setFacetValues(query, "source", ["etl"])).toBe(
            'grid is:draft tag:"Energy Mix" "solar power" is:etl'
        )
    })

    it("keep the facet's exclusions, except of a value now included", () => {
        expect(setFacetValues("-tag:Health x", "tag", ["Energy"])).toBe(
            "-tag:Health x tag:Energy"
        )
        expect(setFacetValues("-tag:Health x", "tag", ["health"])).toBe(
            "x tag:health"
        )
        expect(setFacetValues("-is:draft", "status", [])).toBe("-is:draft")
    })

    it("write a query that reads back the same", () => {
        const rewritten = setFacetValues("", "author", ["Ada Lovelace"])
        expect(getFacetValues(rewritten, "author")).toEqual(["Ada Lovelace"])
        expect(ids(rewritten)).toEqual([1, 2, 3])
    })

    it("tell a query with filters from one of plain words", () => {
        expect(hasChartFilters("energy use")).toBe(false)
        expect(hasChartFilters("energy tag:")).toBe(false)
        expect(hasChartFilters("energy tag:Energy")).toBe(true)
    })
})

describe(chartSearchWordsToHighlight, () => {
    it("highlights plain words, and named authors only among authors", () => {
        const { inText, inAuthors } = chartSearchWordsToHighlight(
            'solar -wind tag:Energy author:"Ada Lovelace"'
        )
        const pairs = (words: typeof inText): [string, boolean][] =>
            words.map(({ word, exclude }) => [word, exclude])
        expect(pairs(inText)).toEqual([
            ["solar", false],
            ["wind", true],
        ])
        expect(pairs(inAuthors)).toEqual([
            ["solar", false],
            ["wind", true],
            ["Ada Lovelace", false],
        ])
    })
})

describe(splitOffCurrentTerm, () => {
    it("splits off the last term, or none after a space", () => {
        expect(splitOffCurrentTerm("solar tag:ene")).toEqual({
            before: "solar ",
            current: "tag:ene",
        })
        expect(splitOffCurrentTerm("solar ")).toEqual({
            before: "solar ",
            current: "",
        })
    })

    it("keeps a space inside an open quote in the term", () => {
        expect(splitOffCurrentTerm('x tag:"Energy M')).toEqual({
            before: "x ",
            current: 'tag:"Energy M',
        })
    })
})

describe(suggestChartSearchTerms, () => {
    const names = {
        tags: countNames(CHARTS, (c) => c.tags.map((t) => t.name)),
        authors: countNames(CHARTS, (c) => [c.lastEditedBy, c.publishedBy]),
    }
    const suggest = (query: string): [string, string][] =>
        suggestChartSearchTerms(query, names).map((s) => [
            s.group,
            s.resultingQuery,
        ])

    it("offers a field's values after it, finishing the term", () => {
        expect(suggest("solar tag:mix")).toEqual([
            ["Tags", 'solar tag:"Energy Mix" '],
        ])
        expect(suggest("is:d")).toEqual([
            ["Status and source", "is:draft "],
            ["Status and source", "is:drifted "],
        ])
    })

    it("offers the filters a plain word could mean", () => {
        expect(suggest("ener")).toEqual([
            ["Tags", "tag:Energy "],
            ["Tags", 'tag:"Energy Mix" '],
        ])
        expect(suggest("gra")).toEqual([["Authors", 'author:"Grace Hopper" ']])
        expect(suggest("aut")).toEqual([["Filters", "author:"]])
    })

    it("keeps an exclusion, and skips values already in the query", () => {
        expect(suggest("-tag:health")).toEqual([["Tags", "-tag:Health "]])
        expect(suggest("tag:Energy tag:ener")).toEqual([
            ["Tags", 'tag:Energy tag:"Energy Mix" '],
        ])
        expect(suggest("-tag:Energy -tag:ener")).toEqual([
            ["Tags", '-tag:Energy -tag:"Energy Mix" '],
        ])
        expect(suggest("is:draft is:d")).toEqual([
            ["Status and source", "is:draft is:drifted "],
        ])
    })

    it("offers the name the term being typed already spells", () => {
        expect(suggest("tag:energy")).toEqual([
            ["Tags", "tag:Energy "],
            ["Tags", 'tag:"Energy Mix" '],
        ])
    })

    it("replaces all the words of a multi-word name, offering nothing for the last word alone", () => {
        expect(suggest("solar life exp")).toEqual([
            ["Tags", 'solar tag:"Life Expectancy" '],
        ])
    })

    it("keeps a name going past a space", () => {
        expect(suggest("life ")).toEqual([["Tags", 'tag:"Life Expectancy" ']])
    })

    it("keeps a tag: term going past a space", () => {
        expect(suggest("tag:life exp")).toEqual([
            ["Tags", 'tag:"Life Expectancy" '],
        ])
        expect(suggest("-tag:life exp")).toEqual([
            ["Tags", '-tag:"Life Expectancy" '],
        ])
    })

    it("finds a multi-word name inside an open quote", () => {
        expect(suggest('author:"grace h')).toEqual([
            ["Authors", 'author:"Grace Hopper" '],
        ])
    })

    it("falls back to the last word when the phrase names nothing", () => {
        expect(suggest("solar ener")).toEqual([
            ["Tags", "solar tag:Energy "],
            ["Tags", 'solar tag:"Energy Mix" '],
        ])
        expect(suggest("energy use ")).toEqual([])
    })

    it("offers nothing for an empty term or a word under three letters", () => {
        expect(suggest("")).toEqual([])
        expect(suggest("solar ")).toEqual([])
        expect(suggest("en")).toEqual([])
    })
})

// The multi-dims list searches with the same grammar, describing each row as
// the search reads a chart, and offers only the filters that tell multi-dims
// apart: status and tags
describe("searching rows that aren't charts", () => {
    interface Row {
        id: number
        title: string
        published: boolean
        topicTags: string[]
    }
    const ROWS: Row[] = [
        {
            id: 1,
            title: "Energy prices",
            published: false,
            topicTags: ["Energy"],
        },
        {
            id: 2,
            title: "Covid cases",
            published: true,
            topicTags: ["COVID-19"],
        },
        { id: 3, title: "School enrolment", published: true, topicTags: [] },
    ]
    const describeRow = (row: Row): SearchableChart => ({
        text: [row.title, `${row.id}`],
        isPublished: row.published,
        isEtl: true,
        isDrifted: false,
        tags: row.topicTags,
        authors: [],
    })
    const rowIds = (query: string): number[] =>
        ROWS.filter(chartSearchFilter(query, ROWS, describeRow)).map(
            (row) => row.id
        )

    it("reads words, status and tags off the description", () => {
        expect(rowIds("cases")).toEqual([2])
        expect(rowIds("is:published")).toEqual([2, 3])
        expect(rowIds("is:published tag:covid-19")).toEqual([2])
        expect(rowIds("-tag:Energy")).toEqual([2, 3])
    })

    it("suggests only the filters the list offers", () => {
        const suggest = (query: string): string[] =>
            suggestChartSearchTerms(query, {
                tags: countNames(ROWS, (row) => row.topicTags),
                authors: [],
                facets: ["status", "tag"],
            }).map((s) => s.resultingQuery)

        // no is:etl, is:drifted or is:admin: every row is from ETL
        expect(suggest("is:")).toEqual(["is:published ", "is:draft "])
        expect(suggest("ene")).toEqual(["tag:Energy "])
        // no author: field to offer
        expect(suggest("aut")).toEqual([])
    })
})
