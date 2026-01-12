import { describe, it, expect } from "vitest"
import { searchCharts, searchPages } from "./searchApi.js"
import { FilterType } from "@ourworldindata/types"
import type { AlgoliaConfig } from "./algoliaClient.js"

describe("searchCharts with real Algolia", () => {
    // Real Algolia credentials for testing
    const algoliaConfig: AlgoliaConfig = {
        appId: "ASCB5XMYF2",
        apiKey: "bafe9c4659e5657bf750a38fbee5c269",
        indexPrefix: undefined, // Production index (no prefix)
    }

    it("performs basic search with query", async () => {
        const result = await searchCharts(
            algoliaConfig,
            {
                query: "population",
                filters: [],
                requireAllCountries: false,
            },
            0,
            5 // Small page size for testing
        )

        expect(result.query).toBe("population")
        expect(result.hits.length).toBeGreaterThan(0)
        expect(result.hits.length).toBeLessThanOrEqual(5)
        expect(result.nbHits).toBeGreaterThan(0)

        // Check first result has required fields
        expect(result.hits[0]).toHaveProperty("title")
        expect(result.hits[0]).toHaveProperty("slug")
        expect(result.hits[0]).toHaveProperty("type")
        expect(result.hits[0]).toHaveProperty("url")

        // URL should be properly constructed
        expect(result.hits[0].url).toMatch(
            /^https:\/\/ourworldindata\.org\/(grapher|explorers)\//
        )
    })

    it("returns results with country filter", async () => {
        const result = await searchCharts(
            algoliaConfig,
            {
                query: "gdp",
                filters: [{ type: FilterType.COUNTRY, name: "United States" }],
                requireAllCountries: false,
            },
            0,
            5
        )

        expect(result.query).toBe("gdp")
        expect(result.hits.length).toBeGreaterThan(0)
    })

    it("returns results requiring all countries", async () => {
        const result = await searchCharts(
            algoliaConfig,
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
        // Results should exist (charts that have both France and Germany)
        expect(result.nbHits).toBeGreaterThan(0)
    })

    it("filters by topic", async () => {
        const result = await searchCharts(
            algoliaConfig,
            {
                query: "",
                filters: [{ type: FilterType.TOPIC, name: "Health" }],
                requireAllCountries: false,
            },
            0,
            5
        )

        expect(result.hits.length).toBeGreaterThan(0)
    })

    it("throws helpful error for invalid topic when no results found", async () => {
        await expect(
            searchCharts(
                algoliaConfig,
                {
                    query: "",
                    filters: [
                        { type: FilterType.TOPIC, name: "InvalidTopicName123" },
                    ],
                    requireAllCountries: false,
                },
                0,
                5
            )
        ).rejects.toThrow(/does not exist. Available topics:/)
    })

    it("handles pagination", async () => {
        const page0 = await searchCharts(
            algoliaConfig,
            {
                query: "population",
                filters: [],
                requireAllCountries: false,
            },
            0,
            3
        )

        const page1 = await searchCharts(
            algoliaConfig,
            {
                query: "population",
                filters: [],
                requireAllCountries: false,
            },
            1,
            3
        )

        expect(page0.page).toBe(0)
        expect(page0.hitsPerPage).toBe(3)
        expect(page0.hits.length).toBe(3)

        expect(page1.page).toBe(1)
        expect(page1.hitsPerPage).toBe(3)
        expect(page1.hits.length).toBe(3)

        // Pages should have different results
        expect(page0.hits[0].slug).not.toBe(page1.hits[0].slug)
    })

    it("constructs correct URLs for different chart types", async () => {
        const result = await searchCharts(
            algoliaConfig,
            {
                query: "covid",
                filters: [],
                requireAllCountries: false,
            },
            0,
            20
        )

        expect(result.hits.length).toBeGreaterThan(0)

        // Find examples of different types if they exist
        const chartResult = result.hits.find((r) => r.type === "chart")
        const explorerResult = result.hits.find(
            (r) => r.type === "explorerView"
        )

        if (chartResult) {
            expect(chartResult.url).toBe(
                `https://ourworldindata.org/grapher/${chartResult.slug}`
            )
        }

        if (explorerResult) {
            expect(explorerResult.url).toMatch(
                /^https:\/\/ourworldindata\.org\/explorers\//
            )
        }
    })

    it("removes internal Algolia fields from results", async () => {
        const result = await searchCharts(
            algoliaConfig,
            {
                query: "population",
                filters: [],
                requireAllCountries: false,
            },
            0,
            1
        )

        expect(result.hits.length).toBeGreaterThan(0)

        // Internal Algolia fields should be removed (except _highlightResult which is needed for frontend)
        expect(result.hits[0]).not.toHaveProperty("objectID")
        expect(result.hits[0]).toHaveProperty("_highlightResult") // Preserved for frontend highlighting
        expect(result.hits[0]).not.toHaveProperty("_snippetResult")

        // Required fields should be present
        expect(result.hits[0]).toHaveProperty("title")
        expect(result.hits[0]).toHaveProperty("slug")
        expect(result.hits[0]).toHaveProperty("type")
        expect(result.hits[0]).toHaveProperty("url")
    })

    it("returns empty results for nonsense query", async () => {
        const result = await searchCharts(
            algoliaConfig,
            {
                query: "xyzabc123nonsense456",
                filters: [],
                requireAllCountries: false,
            },
            0,
            20
        )

        expect(result.query).toBe("xyzabc123nonsense456")
        expect(result.hits.length).toBe(0)
        expect(result.nbHits).toBe(0)
    })

    it("uses custom base URL for staging deployments", async () => {
        const stagingUrl = "https://staging-pr-123.owid.io"
        const result = await searchCharts(
            algoliaConfig,
            {
                query: "population",
                filters: [],
                requireAllCountries: false,
            },
            0,
            3,
            stagingUrl
        )

        expect(result.hits.length).toBeGreaterThan(0)

        // All URLs should use the staging base URL
        result.hits.forEach((hit) => {
            expect(hit.url).toMatch(/^https:\/\/staging-pr-123\.owid\.io\//)
        })
    })
})

describe("searchPages with real Algolia", () => {
    const algoliaConfig: AlgoliaConfig = {
        appId: "ASCB5XMYF2",
        apiKey: "bafe9c4659e5657bf750a38fbee5c269",
        indexPrefix: undefined,
    }

    it("searches for 'banana production' pages", async () => {
        const result = await searchPages(
            algoliaConfig,
            "banana production",
            0,
            5
        )

        expect(result.query).toBe("banana production")
        expect(result.results.length).toBeGreaterThan(0)
        expect(result.results.length).toBeLessThanOrEqual(5)
        expect(result.nbHits).toBeGreaterThan(0)

        // Check first result has required fields
        const firstResult = result.results[0]
        expect(firstResult).toHaveProperty("title")
        expect(firstResult).toHaveProperty("slug")
        expect(firstResult).toHaveProperty("type")
        expect(firstResult).toHaveProperty("url")

        // URL should be properly constructed
        expect(firstResult.url).toMatch(/^https:\/\/ourworldindata\.org\//)

        console.log("\nFirst page result for 'banana production':")
        console.log(`Title: ${firstResult.title}`)
        console.log(`Slug: ${firstResult.slug}`)
        console.log(`Type: ${firstResult.type}`)
        console.log(`URL: ${firstResult.url}`)
    })

    it("performs basic page search", async () => {
        const result = await searchPages(algoliaConfig, "climate change", 0, 5)

        expect(result.query).toBe("climate change")
        expect(result.results.length).toBeGreaterThan(0)
        expect(result.offset).toBe(0)
        expect(result.length).toBe(5)

        // Check required fields
        expect(result.results[0]).toHaveProperty("title")
        expect(result.results[0]).toHaveProperty("slug")
        expect(result.results[0]).toHaveProperty("type")
        expect(result.results[0]).toHaveProperty("url")
    })

    it("handles pagination with offset", async () => {
        const page1 = await searchPages(algoliaConfig, "health", 0, 3)
        const page2 = await searchPages(algoliaConfig, "health", 3, 3)

        expect(page1.offset).toBe(0)
        expect(page1.length).toBe(3)
        expect(page1.results.length).toBe(3)

        expect(page2.offset).toBe(3)
        expect(page2.length).toBe(3)
        expect(page2.results.length).toBe(3)

        // Pages should have different results
        expect(page1.results[0].slug).not.toBe(page2.results[0].slug)
    })

    it("filters by page types", async () => {
        const result = await searchPages(algoliaConfig, "about", 0, 5, [
            "about-page",
        ])

        expect(result.results.length).toBeGreaterThan(0)
        // All results should be about-pages
        result.results.forEach((page) => {
            expect(page.type).toBe("about-page")
        })
    })

    it("removes internal Algolia fields from results", async () => {
        const result = await searchPages(algoliaConfig, "population", 0, 1)

        expect(result.results.length).toBeGreaterThan(0)

        // Internal Algolia fields should be removed
        expect(result.results[0]).not.toHaveProperty("objectID")
        expect(result.results[0]).not.toHaveProperty("_highlightResult")
        expect(result.results[0]).not.toHaveProperty("_snippetResult")

        // Required fields should be present
        expect(result.results[0]).toHaveProperty("title")
        expect(result.results[0]).toHaveProperty("slug")
        expect(result.results[0]).toHaveProperty("type")
        expect(result.results[0]).toHaveProperty("url")
    })

    it("returns empty results for nonsense query", async () => {
        const result = await searchPages(
            algoliaConfig,
            "xyzabc123nonsense456",
            0,
            10
        )

        expect(result.query).toBe("xyzabc123nonsense456")
        expect(result.results.length).toBe(0)
        expect(result.nbHits).toBe(0)
    })

    it("uses custom base URL for staging deployments", async () => {
        const stagingUrl = "https://staging-pr-123.owid.io"
        const result = await searchPages(
            algoliaConfig,
            "climate change",
            0,
            3,
            ["article", "about-page"],
            stagingUrl
        )

        expect(result.results.length).toBeGreaterThan(0)

        // All URLs should use the staging base URL
        result.results.forEach((hit) => {
            expect(hit.url).toMatch(/^https:\/\/staging-pr-123\.owid\.io\//)
        })
    })
})
