import { ChartRecordType, FilterType } from "@ourworldindata/types"
import { describe, expect, it } from "vitest"
import type { AlgoliaConfig } from "./algoliaClient.js"
import { searchCharts, searchPages } from "./searchApi.js"

const PRODUCTION_SEARCH_CONFIG: AlgoliaConfig = {
    appId: "ASCB5XMYF2",
    apiKey: "bafe9c4659e5657bf750a38fbee5c269",
    indexPrefix: undefined,
}

function expectPublicResultShape(result: unknown): void {
    expect(result).toMatchObject({
        title: expect.any(String),
        slug: expect.any(String),
        type: expect.any(String),
        url: expect.any(String),
    })
    expect(result).not.toHaveProperty("objectID")
    expect(result).not.toHaveProperty("_highlightResult")
    expect(result).not.toHaveProperty("_snippetResult")
}

// These tests exercise the deployed Algolia indexes rather than fixtures.
// They protect coarse API contracts—filtering, paging, public result shape,
// and URL construction—while deliberately avoiding result order and totals,
// which legitimately change as production content is reindexed.
describe("searchCharts with production Algolia", () => {
    it("returns a bounded page of public chart results", async () => {
        const result = await searchCharts(
            PRODUCTION_SEARCH_CONFIG,
            {
                query: "population",
                filters: [],
                requireAllCountries: false,
            },
            0,
            5
        )

        expect(result).toMatchObject({
            query: "population",
            page: 0,
            hitsPerPage: 5,
        })
        expect(result.nbHits).toBeGreaterThan(0)
        expect(result.results.length).toBeGreaterThan(0)
        expect(result.results.length).toBeLessThanOrEqual(5)
        expectPublicResultShape(result.results[0])
    })

    // Each filter mode takes a different path through facet construction.
    // Broad, established topics make these assertions resilient to ranking
    // changes while still proving that the live index accepts the filters.
    describe("filter modes", () => {
        it("accepts a single-country filter", async () => {
            const result = await searchCharts(
                PRODUCTION_SEARCH_CONFIG,
                {
                    query: "gdp",
                    filters: [
                        { type: FilterType.COUNTRY, name: "United States" },
                    ],
                    requireAllCountries: false,
                },
                0,
                5
            )

            expect(result.query).toBe("gdp")
            expect(result.results.length).toBeGreaterThan(0)
        })

        it("accepts an all-countries filter", async () => {
            const result = await searchCharts(
                PRODUCTION_SEARCH_CONFIG,
                {
                    query: "gdp",
                    filters: [
                        { type: FilterType.COUNTRY, name: "France" },
                        { type: FilterType.COUNTRY, name: "Germany" },
                    ],
                    requireAllCountries: true,
                },
                0,
                5
            )

            expect(result.query).toBe("gdp")
            expect(result.nbHits).toBeGreaterThan(0)
        })

        it("accepts a topic filter without a text query", async () => {
            const result = await searchCharts(
                PRODUCTION_SEARCH_CONFIG,
                {
                    query: "",
                    filters: [{ type: FilterType.TOPIC, name: "Health" }],
                    requireAllCountries: false,
                },
                0,
                5
            )

            expect(result.results.length).toBeGreaterThan(0)
        })

        it("explains which topic is invalid when no results exist", async () => {
            await expect(
                searchCharts(
                    PRODUCTION_SEARCH_CONFIG,
                    {
                        query: "",
                        filters: [
                            {
                                type: FilterType.TOPIC,
                                name: "InvalidTopicName123",
                            },
                        ],
                        requireAllCountries: false,
                    },
                    0,
                    5
                )
            ).rejects.toThrow(/does not exist. Available topics:/)
        })

        it("recognizes a valid topic beyond Algolia's default facet limit", async () => {
            // "Polio" falls outside the 100 commonest topic tags. The topic
            // lookup must request the full supported facet list before
            // deciding that a zero-result query used an invalid topic.
            const result = await searchCharts(
                PRODUCTION_SEARCH_CONFIG,
                {
                    query: "zzzzqqqqnotarealquery",
                    filters: [{ type: FilterType.TOPIC, name: "Polio" }],
                    requireAllCountries: false,
                },
                0,
                5
            )

            expect(result.nbHits).toBe(0)
            expect(result.results).toEqual([])
        })
    })

    it("returns distinct result windows for consecutive pages", async () => {
        const page0 = await searchCharts(
            PRODUCTION_SEARCH_CONFIG,
            {
                query: "population",
                filters: [],
                requireAllCountries: false,
            },
            0,
            3
        )
        const page1 = await searchCharts(
            PRODUCTION_SEARCH_CONFIG,
            {
                query: "population",
                filters: [],
                requireAllCountries: false,
            },
            1,
            3
        )

        expect(page0).toMatchObject({ page: 0, hitsPerPage: 3 })
        expect(page1).toMatchObject({ page: 1, hitsPerPage: 3 })
        expect(page0.results).toHaveLength(3)
        expect(page1.results).toHaveLength(3)
        expect(page0.results[0].slug).not.toBe(page1.results[0].slug)
    })

    it("uses the canonical URL form for every returned chart type", async () => {
        const result = await searchCharts(
            PRODUCTION_SEARCH_CONFIG,
            {
                query: "covid",
                filters: [],
                requireAllCountries: false,
            },
            0,
            20
        )

        expect(result.results.length).toBeGreaterThan(0)
        for (const hit of result.results) {
            if (hit.type === ChartRecordType.ExplorerView) {
                expect(hit.url, hit.slug).toMatch(
                    new RegExp(
                        `^https://ourworldindata\\.org/explorers/${hit.slug}`
                    )
                )
            } else if (hit.type === ChartRecordType.MultiDimView) {
                expect(hit.url, hit.slug).toMatch(
                    new RegExp(
                        `^https://ourworldindata\\.org/grapher/${hit.slug}`
                    )
                )
            } else {
                expect(hit.url, hit.slug).toBe(
                    `https://ourworldindata.org/grapher/${hit.slug}`
                )
            }
        }
    })

    it("returns no hits for a nonsense query", async () => {
        const result = await searchCharts(
            PRODUCTION_SEARCH_CONFIG,
            {
                query: "xyzabc123nonsense456",
                filters: [],
                requireAllCountries: false,
            },
            0,
            20
        )

        expect(result).toMatchObject({
            query: "xyzabc123nonsense456",
            nbHits: 0,
            results: [],
        })
    })

    it("applies a deployment-specific base URL to every hit", async () => {
        const stagingUrl = "https://staging-pr-123.owid.io"
        const result = await searchCharts(
            PRODUCTION_SEARCH_CONFIG,
            {
                query: "population",
                filters: [],
                requireAllCountries: false,
            },
            0,
            3,
            stagingUrl
        )

        expect(result.results.length).toBeGreaterThan(0)
        for (const hit of result.results) {
            expect(hit.url, hit.slug).toMatch(
                /^https:\/\/staging-pr-123\.owid\.io\//
            )
        }
    })
})

describe("searchPages with production Algolia", () => {
    it("returns a bounded page of public page results", async () => {
        const result = await searchPages(
            PRODUCTION_SEARCH_CONFIG,
            "banana production",
            0,
            5
        )

        expect(result).toMatchObject({
            query: "banana production",
            offset: 0,
            length: 5,
        })
        expect(result.nbHits).toBeGreaterThan(0)
        expect(result.results.length).toBeGreaterThan(0)
        expect(result.results.length).toBeLessThanOrEqual(5)
        expectPublicResultShape(result.results[0])
        expect(result.results[0].url).toMatch(
            /^https:\/\/ourworldindata\.org\//
        )
    })

    it("returns distinct result windows for consecutive offsets", async () => {
        const page1 = await searchPages(
            PRODUCTION_SEARCH_CONFIG,
            "health",
            0,
            3
        )
        const page2 = await searchPages(
            PRODUCTION_SEARCH_CONFIG,
            "health",
            3,
            3
        )

        expect(page1).toMatchObject({ offset: 0, length: 3 })
        expect(page2).toMatchObject({ offset: 3, length: 3 })
        expect(page1.results).toHaveLength(3)
        expect(page2.results).toHaveLength(3)
        expect(page1.results[0].slug).not.toBe(page2.results[0].slug)
    })

    it("returns only the requested page type", async () => {
        const result = await searchPages(
            PRODUCTION_SEARCH_CONFIG,
            "about",
            0,
            5,
            ["about-page"]
        )

        expect(result.results.length).toBeGreaterThan(0)
        for (const page of result.results) {
            expect(page.type, page.slug).toBe("about-page")
        }
    })

    it("uses the data-insight path for data-insight pages", async () => {
        const result = await searchPages(
            PRODUCTION_SEARCH_CONFIG,
            "co2",
            0,
            5,
            ["data-insight"]
        )

        expect(result.results.length).toBeGreaterThan(0)
        for (const page of result.results) {
            expect(page.type, page.slug).toBe("data-insight")
            expect(page.url, page.slug).toBe(
                `https://ourworldindata.org/data-insights/${page.slug}`
            )
        }
    })

    it("returns no hits for a nonsense query", async () => {
        const result = await searchPages(
            PRODUCTION_SEARCH_CONFIG,
            "xyzabc123nonsense456",
            0,
            10
        )

        expect(result).toMatchObject({
            query: "xyzabc123nonsense456",
            nbHits: 0,
            results: [],
        })
    })

    it("applies a deployment-specific base URL to every hit", async () => {
        const stagingUrl = "https://staging-pr-123.owid.io"
        const result = await searchPages(
            PRODUCTION_SEARCH_CONFIG,
            "climate change",
            0,
            3,
            ["article", "about-page"],
            stagingUrl
        )

        expect(result.results.length).toBeGreaterThan(0)
        for (const hit of result.results) {
            expect(hit.url, hit.slug).toMatch(
                /^https:\/\/staging-pr-123\.owid\.io\//
            )
        }
    })
})
