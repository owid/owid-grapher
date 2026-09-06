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
                filters: [{ type: FilterType.TOPIC, name: "Health" }],
                requireAllCountries: false,
            },
            0,
            5
        )

        expect(result.results.length).toBeGreaterThan(0)
    })

    it("does not claim a valid topic doesn't exist just because the search found nothing", async () => {
        // The topic list this validation consults comes from a facet query, and
        // Algolia caps facet values at 100 unless asked for more, while the
        // index carries ~140 topic tags. "Polio" is a real topic that falls
        // outside the 100 commonest, so before maxValuesPerFacet was set this
        // rejected it as nonexistent whenever a query returned nothing.
        const result = await searchCharts(
            algoliaConfig,
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
})

describe("searchPages with real Algolia", () => {
    const algoliaConfig: AlgoliaConfig = {
        appId: "ASCB5XMYF2",
        apiKey: "bafe9c4659e5657bf750a38fbee5c269",
        indexPrefix: undefined,
    }

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
})
