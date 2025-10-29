import { describe, it, expect } from "vitest"
import { searchCharts } from "./searchApi.js"
import { FilterType } from "./types.js"
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
        expect(result.results.length).toBeGreaterThan(0)
        expect(result.results.length).toBeLessThanOrEqual(5)
        expect(result.nbHits).toBeGreaterThan(0)

        // Check first result has required fields
        expect(result.results[0]).toHaveProperty("title")
        expect(result.results[0]).toHaveProperty("slug")
        expect(result.results[0]).toHaveProperty("type")
        expect(result.results[0]).toHaveProperty("url")

        // URL should be properly constructed
        expect(result.results[0].url).toMatch(/^https:\/\/ourworldindata\.org\/(grapher|explorers)\//)
    })

    it("returns results with country filter", async () => {
        const result = await searchCharts(
            algoliaConfig,
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
                filters: [
                    { type: FilterType.TOPIC, name: "Health" },
                ],
                requireAllCountries: false,
            },
            0,
            5
        )

        expect(result.results.length).toBeGreaterThan(0)
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
        expect(page0.results.length).toBe(3)

        expect(page1.page).toBe(1)
        expect(page1.hitsPerPage).toBe(3)
        expect(page1.results.length).toBe(3)

        // Pages should have different results
        expect(page0.results[0].slug).not.toBe(page1.results[0].slug)
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

        expect(result.results.length).toBeGreaterThan(0)

        // Find examples of different types if they exist
        const chartResult = result.results.find(r => r.type === "chart")
        const explorerResult = result.results.find(r => r.type === "explorerView")

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
        expect(result.results.length).toBe(0)
        expect(result.nbHits).toBe(0)
    })
})
