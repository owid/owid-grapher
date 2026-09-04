import { expect, it, describe, vi } from "vitest"
import {
    TagGraphNode,
    TagGraphRoot,
    TagGraphRootName,
} from "@ourworldindata/types"
import {
    rankTopicsByChartTagCounts,
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

describe(rankTopicsByChartTagCounts, () => {
    it("orders topics by chart count, skipping areas", () => {
        const topics = rankTopicsByChartTagCounts(
            {
                "Poverty and Economic Development": 171,
                "Energy and Environment": 137,
                "Economic Growth": 111,
                Poverty: 40,
                "CO2 & Greenhouse Gas Emissions": 60,
            },
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

    it("finds nested topics and ignores tags without a topic page", () => {
        const topics = rankTopicsByChartTagCounts(
            { "Climate Change": 5, Crime: 30, Unknown: 99 },
            tagGraph
        )
        expect(topics).toEqual([
            { name: "Climate Change", slug: "climate-change" },
        ])
    })

    it("returns nothing when no chart matched", () => {
        expect(rankTopicsByChartTagCounts({}, tagGraph)).toEqual([])
    })
})

type MockHit = { slug: string; title: string }

function makeClient(responses: unknown[]) {
    const searchForHits = vi.fn()
    for (const response of responses) {
        searchForHits.mockResolvedValueOnce({ results: [response] })
    }
    return { searchForHits }
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
                hits: [],
                facets: {
                    tags: {
                        "Poverty and Economic Development": 100,
                        Poverty: 5,
                        "Economic Growth": 50,
                    },
                },
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
            facets: ["tags"],
            hitsPerPage: 0,
        })
        const [pagesRequest] = client.searchForHits.mock.calls[1][0]
        expect(pagesRequest).toMatchObject({
            indexName: "pages",
            query: "",
            filters: "type:topic-page OR type:linear-topic-page",
            facetFilters: [["path:/economic-growth", "path:/poverty"]],
        })
    })

    it("paginates locally and skips topics whose page is not in the index", async () => {
        const client = makeClient([
            {
                hits: [],
                facets: {
                    tags: {
                        "Economic Growth": 50,
                        "Climate Change": 20,
                        Poverty: 5,
                    },
                },
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

    it("returns undefined without querying pages when no chart matched", async () => {
        const client = makeClient([{ hits: [], facets: {} }])

        const result = await searchTopicPagesOfMatchingCharts<MockHit>(
            client as never,
            params
        )

        expect(result).toBeUndefined()
        expect(client.searchForHits).toHaveBeenCalledOnce()
    })
})

