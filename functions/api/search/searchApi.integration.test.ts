import { describe, it, expect } from "vitest"
import { searchCharts, searchPages } from "./searchApi.js"
import { FilterType } from "@ourworldindata/types"
import type { TypesenseConfig } from "./typesenseClient.js"

/**
 * Integration tests for Typesense search.
 *
 * These tests require a running Typesense instance with indexed data.
 * Run `make up.full` and `make reindex.typesense` before running these.
 *
 * To run:  yarn test run functions/api/search/searchApi.integration.test.ts
 */
describe("searchCharts with real Typesense", () => {
    const typesenseConfig: TypesenseConfig = {
        host: "localhost",
        port: 8108,
        protocol: "http",
        apiKey: "xyz",
    }

    it("performs basic search with query", async () => {
        const result = await searchCharts(
            typesenseConfig,
            {
                query: "population",
                filters: [],
                requireAllCountries: false,
            },
            0,
            5
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
        expect(result.results[0].url).toMatch(
            /^https:\/\/ourworldindata\.org\/(grapher|explorers)\//
        )
    })

    it("returns results with country filter", async () => {
        const result = await searchCharts(
            typesenseConfig,
            {
                query: "gdp",
                filters: [{ type: FilterType.COUNTRY, name: "United States" }],
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
            typesenseConfig,
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

    it("filters by topic", async () => {
        const result = await searchCharts(
            typesenseConfig,
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

    it("handles pagination", async () => {
        const page0 = await searchCharts(
            typesenseConfig,
            {
                query: "population",
                filters: [],
                requireAllCountries: false,
            },
            0,
            3
        )

        const page1 = await searchCharts(
            typesenseConfig,
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
            typesenseConfig,
            {
                query: "covid",
                filters: [],
                requireAllCountries: false,
            },
            0,
            20
        )

        expect(result.results.length).toBeGreaterThan(0)

        const chartResult = result.results.find((r) => r.type === "chart")
        const explorerResult = result.results.find(
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

    it("supports custom alpha for hybrid search", async () => {
        // Pure keyword search
        const keywordResult = await searchCharts(
            typesenseConfig,
            {
                query: "what causes people to die young",
                filters: [],
                requireAllCountries: false,
            },
            0,
            5,
            undefined,
            0.0 // pure keyword
        )

        // Pure semantic search
        const semanticResult = await searchCharts(
            typesenseConfig,
            {
                query: "what causes people to die young",
                filters: [],
                requireAllCountries: false,
            },
            0,
            5,
            undefined,
            1.0 // pure semantic
        )

        // Both should return results
        expect(keywordResult.results.length).toBeGreaterThan(0)
        expect(semanticResult.results.length).toBeGreaterThan(0)

        // Results may differ between keyword and semantic search
        // (not guaranteed, but likely for natural language queries)
    })

    it("uses custom base URL for staging deployments", async () => {
        const stagingUrl = "https://staging-pr-123.owid.io"
        const result = await searchCharts(
            typesenseConfig,
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

        result.results.forEach((hit) => {
            expect(hit.url).toMatch(/^https:\/\/staging-pr-123\.owid\.io\//)
        })
    })

    it("returns empty results for nonsense query", async () => {
        const result = await searchCharts(
            typesenseConfig,
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

describe("searchPages with real Typesense", () => {
    const typesenseConfig: TypesenseConfig = {
        host: "localhost",
        port: 8108,
        protocol: "http",
        apiKey: "xyz",
    }

    it("performs basic page search", async () => {
        const result = await searchPages(
            typesenseConfig,
            "climate change",
            0,
            5
        )

        expect(result.query).toBe("climate change")
        expect(result.results.length).toBeGreaterThan(0)
        expect(result.offset).toBe(0)
        expect(result.length).toBe(5)

        expect(result.results[0]).toHaveProperty("title")
        expect(result.results[0]).toHaveProperty("slug")
        expect(result.results[0]).toHaveProperty("type")
        expect(result.results[0]).toHaveProperty("url")
    })

    it("handles pagination with offset", async () => {
        const page1 = await searchPages(typesenseConfig, "health", 0, 3)
        const page2 = await searchPages(typesenseConfig, "health", 3, 3)

        expect(page1.offset).toBe(0)
        expect(page1.length).toBe(3)
        expect(page1.results.length).toBe(3)

        expect(page2.offset).toBe(3)
        expect(page2.length).toBe(3)
        expect(page2.results.length).toBe(3)

        expect(page1.results[0].slug).not.toBe(page2.results[0].slug)
    })

    it("filters by page types", async () => {
        const result = await searchPages(typesenseConfig, "about", 0, 5, [
            "about-page",
        ])

        expect(result.results.length).toBeGreaterThan(0)
        result.results.forEach((page) => {
            expect(page.type).toBe("about-page")
        })
    })

    it("supports custom alpha for hybrid search", async () => {
        const keywordResult = await searchPages(
            typesenseConfig,
            "banana production",
            0,
            5,
            undefined,
            undefined,
            0.0
        )

        const semanticResult = await searchPages(
            typesenseConfig,
            "banana production",
            0,
            5,
            undefined,
            undefined,
            1.0
        )

        expect(keywordResult.results.length).toBeGreaterThan(0)
        expect(semanticResult.results.length).toBeGreaterThan(0)
    })

    it("returns empty results for nonsense query", async () => {
        const result = await searchPages(
            typesenseConfig,
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
            typesenseConfig,
            "climate change",
            0,
            3,
            ["article", "about-page"],
            stagingUrl
        )

        expect(result.results.length).toBeGreaterThan(0)

        result.results.forEach((hit) => {
            expect(hit.url).toMatch(/^https:\/\/staging-pr-123\.owid\.io\//)
        })
    })
})
