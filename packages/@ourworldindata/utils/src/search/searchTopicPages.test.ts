import { expect, it, describe, vi } from "vitest"
import {
    FilterType,
    TagGraphNode,
    TagGraphRoot,
    TagGraphRootName,
} from "@ourworldindata/types"
import {
    rankTopicsOfChartHits,
    recommendTopicPages,
    searchTopicPagesOfMatchingCharts,
} from "./searchTopicPages.js"

let nextId = 1
const node = (
    name: string,
    options: {
        slug?: string | null
        isTopic?: boolean
        children?: TagGraphNode[]
    } = {}
): TagGraphNode => ({
    id: nextId++,
    name,
    slug: options.slug ?? null,
    isTopic: options.isTopic ?? Boolean(options.slug),
    isSearchable: true,
    children: options.children ?? [],
    path: [],
    weight: 0,
})
const tagGraph: TagGraphRoot = {
    ...node(TagGraphRootName, {
        children: [
            node("Poverty and Economic Development", {
                children: [
                    node("Economic Growth", { slug: "economic-growth" }),
                    node("Poverty", { slug: "poverty" }),
                    // Searchable tag without a topic page (see
                    // tags.searchableInAlgolia)
                    node("Crime", { isTopic: false }),
                ],
            }),
            node("Energy and Environment", {
                children: [
                    node("CO2 & Greenhouse Gas Emissions", {
                        slug: "co2-and-greenhouse-gas-emissions",
                        children: [
                            node("Climate Change", { slug: "climate-change" }),
                        ],
                    }),
                ],
            }),
        ],
    }),
    name: TagGraphRootName,
    isTopic: false,
    isSearchable: false,
    slug: null,
    weight: 0,
    path: [0],
}

const hit = (...tags: string[]): { tags: string[] } => ({ tags })

describe(rankTopicsOfChartHits, () => {
    it("lets the best-ranked charts decide, skipping areas", () => {
        const topics = rankTopicsOfChartHits(
            [
                hit("Poverty and Economic Development", "Economic Growth"),
                hit("Poverty and Economic Development", "Economic Growth"),
                hit("Energy and Environment", "CO2 & Greenhouse Gas Emissions"),
                hit("Poverty and Economic Development", "Poverty"),
            ],
            tagGraph
        )
        expect(topics).toEqual([
            { name: "Economic Growth", slug: "economic-growth" },
            {
                name: "CO2 & Greenhouse Gas Emissions",
                slug: "co2-and-greenhouse-gas-emissions",
            },
            { name: "Poverty", slug: "poverty" },
        ])
    })

    it("does not let many low-ranked charts outvote the top hits", () => {
        // One chart at rank 1 vs. five charts at ranks 20-24: the sum of the
        // low ranks' reciprocal weights (~0.23) stays below the top hit's 1.
        const lowRanked = Array.from({ length: 19 }, () => hit())
        const topics = rankTopicsOfChartHits(
            [
                hit("Economic Growth"),
                ...lowRanked,
                ...Array.from({ length: 5 }, () => hit("Poverty")),
            ],
            tagGraph
        )
        expect(topics.map((topic) => topic.name)).toEqual([
            "Economic Growth",
            "Poverty",
        ])
    })

    it("finds nested topics and ignores tags without a topic page", () => {
        const topics = rankTopicsOfChartHits(
            [hit("Crime", "Unknown"), hit("Climate Change")],
            tagGraph
        )
        expect(topics).toEqual([
            { name: "Climate Change", slug: "climate-change" },
        ])
    })

    it("returns nothing when no chart matched", () => {
        expect(rankTopicsOfChartHits([], tagGraph)).toEqual([])
    })
})

type MockHit = { slug: string; title: string }

function makeClient(responses: unknown[]): {
    searchForHits: ReturnType<typeof vi.fn>
} {
    const searchForHits = vi.fn()
    for (const response of responses) {
        searchForHits.mockResolvedValueOnce({ results: [response] })
    }
    return { searchForHits }
}

const tagGraphWithPopulation: TagGraphRoot = {
    ...tagGraph,
    children: [
        ...tagGraph.children,
        node("Population and Demographic Change", {
            children: [
                node("Population Growth", { slug: "population-growth" }),
            ],
        }),
    ],
}

describe(searchTopicPagesOfMatchingCharts, () => {
    const params = {
        chartsIndexName: "charts",
        pagesIndexName: "pages",
        query: "gdp",
        chartsFacetFilters: [],
        tagGraph,
        attributesToRetrieve: ["title", "slug"],
        offset: 0,
        length: 10,
    }

    it("returns the topic pages in facet order, whatever order Algolia returns them", async () => {
        const client = makeClient([
            {
                hits: [
                    hit("Poverty and Economic Development", "Economic Growth"),
                    hit("Poverty and Economic Development", "Poverty"),
                ],
            },
            {
                hits: [
                    { slug: "poverty", title: "Poverty" },
                    { slug: "economic-growth", title: "Economic Growth" },
                ],
                nbHits: 2,
            },
        ])

        const result = await searchTopicPagesOfMatchingCharts<MockHit>(
            client as never,
            params
        )

        expect(result?.hits.map((hit) => hit.slug)).toEqual([
            "economic-growth",
            "poverty",
        ])
        expect(result?.nbHits).toBe(2)

        const [chartsRequest] = client.searchForHits.mock.calls[0][0]
        expect(chartsRequest).toMatchObject({
            indexName: "charts",
            query: "gdp",
            attributesToRetrieve: ["tags"],
            queryType: "prefixNone",
        })
        const [pagesRequest] = client.searchForHits.mock.calls[1][0]
        expect(pagesRequest).toMatchObject({
            indexName: "pages",
            query: "",
            filters: "type:topic-page OR type:linear-topic-page",
            facetFilters: [["path:/economic-growth", "path:/poverty"]],
        })
    })

    it("requests the pages in a fixed order, so the cache key ignores the ranking", async () => {
        const client = makeClient([
            { hits: [hit("Poverty"), hit("Economic Growth")] },
            {
                hits: [
                    { slug: "economic-growth", title: "Economic Growth" },
                    { slug: "poverty", title: "Poverty" },
                ],
                nbHits: 2,
            },
        ])

        const result = await searchTopicPagesOfMatchingCharts<MockHit>(
            client as never,
            params
        )

        expect(result?.hits.map((hit) => hit.slug)).toEqual([
            "poverty",
            "economic-growth",
        ])
        const [pagesRequest] = client.searchForHits.mock.calls[1][0]
        expect(pagesRequest.facetFilters).toEqual([
            ["path:/economic-growth", "path:/poverty"],
        ])
    })

    it("paginates locally and skips topics whose page is not in the index", async () => {
        const client = makeClient([
            {
                hits: [
                    hit("Economic Growth"),
                    hit("Climate Change"),
                    hit("Poverty"),
                ],
            },
            {
                // No record for climate-change
                hits: [
                    { slug: "economic-growth", title: "Economic Growth" },
                    { slug: "poverty", title: "Poverty" },
                ],
                nbHits: 2,
            },
        ])

        const result = await searchTopicPagesOfMatchingCharts<MockHit>(
            client as never,
            { ...params, offset: 1, length: 1 }
        )

        expect(result?.hits.map((hit) => hit.slug)).toEqual(["poverty"])
        expect(result?.nbHits).toBe(2)
        expect(result?.offset).toBe(1)
        expect(result?.length).toBe(1)
    })

    it("falls back to prefix matching only when whole words match nothing", async () => {
        const client = makeClient([
            { hits: [] }, // "popul" as a whole word
            { hits: [hit("Population Growth")] }, // as a prefix
            {
                hits: [{ slug: "population-growth", title: "Population" }],
                nbHits: 1,
            },
        ])

        const result = await searchTopicPagesOfMatchingCharts<MockHit>(
            client as never,
            { ...params, query: "popul", tagGraph: tagGraphWithPopulation }
        )

        expect(result?.hits.map((hit) => hit.slug)).toEqual([
            "population-growth",
        ])
        const [firstRequest] = client.searchForHits.mock.calls[0][0]
        const [secondRequest] = client.searchForHits.mock.calls[1][0]
        expect(firstRequest.queryType).toBe("prefixNone")
        expect(secondRequest.queryType).toBe("prefixLast")
    })

    it("returns undefined without querying pages when no chart matched", async () => {
        const client = makeClient([{ hits: [] }, { hits: [] }])

        const result = await searchTopicPagesOfMatchingCharts<MockHit>(
            client as never,
            params
        )

        expect(result).toBeUndefined()
        expect(client.searchForHits).toHaveBeenCalledTimes(2)
    })
})

describe(recommendTopicPages, () => {
    const params = {
        chartsIndexName: "charts",
        pagesIndexName: "pages",
        state: {
            query: "max roser",
            filters: [{ type: FilterType.TOPIC, name: "Health" }],
            requireAllCountries: false,
        },
        tagGraph,
        attributesToRetrieve: ["title", "slug"],
        offset: 0,
        length: 10,
    }

    it("searches the topic pages' text when no chart matches, without closest matches", async () => {
        // The site and /api/search both answer through this function, so a
        // query no chart matches must fall back the same way for both: one
        // exact text search, and an empty answer when that finds nothing.
        const client = makeClient([
            { hits: [] }, // charts, whole words
            { hits: [] }, // charts, prefix
            { hits: [], nbHits: 0 }, // topic pages by text
        ])

        const result = await recommendTopicPages<MockHit>(
            client as never,
            params
        )

        expect(result.hits).toEqual([])
        expect(client.searchForHits).toHaveBeenCalledTimes(3)
        const [textRequest] = client.searchForHits.mock.calls[2][0]
        expect(textRequest).toMatchObject({
            indexName: "pages",
            query: "max roser",
            filters: "type:topic-page OR type:linear-topic-page",
            facetFilters: [["tags:Health"]],
        })
        expect(textRequest.removeWordsIfNoResults).toBeUndefined()
    })

    it("goes straight to the text search without a query", async () => {
        const client = makeClient([{ hits: [], nbHits: 0 }])

        await recommendTopicPages<MockHit>(client as never, {
            ...params,
            state: { ...params.state, query: " " },
        })

        expect(client.searchForHits).toHaveBeenCalledOnce()
        const [textRequest] = client.searchForHits.mock.calls[0][0]
        expect(textRequest.indexName).toBe("pages")
    })
})
