import { expect, it, describe } from "vitest"
import { FilterType } from "@ourworldindata/types"
import {
    formatCountryFacetFilters,
    formatFeaturedMetricFacetFilter,
    formatTopicFacetFilters,
    buildChartsFacetFilters,
} from "./searchFacetFilters.js"

// Used by both site/search/queries.ts and functions/api/search/searchApi.ts —
// covering it here guarantees both consumers build identical Algolia
// facetFilters for the same Filter[] input.

describe(formatCountryFacetFilters, () => {
    it("excludes income-group-specific FMs when no countries are selected", () => {
        const result = formatCountryFacetFilters(new Set(), false)
        expect(result).toEqual([[], "isIncomeGroupSpecificFM:false"])
    })

    it("formats a single country with OR logic (requireAll=false)", () => {
        const result = formatCountryFacetFilters(
            new Set(["United States"]),
            false
        )
        expect(result).toEqual([["availableEntities:United States"]])
    })

    it("formats multiple countries with OR logic (requireAll=false)", () => {
        const result = formatCountryFacetFilters(
            new Set(["United States", "China", "India"]),
            false
        )
        expect(result).toEqual([
            [
                "availableEntities:United States",
                "availableEntities:China",
                "availableEntities:India",
            ],
        ])
    })

    it("formats a single country with AND logic (requireAll=true)", () => {
        const result = formatCountryFacetFilters(
            new Set(["United States"]),
            true
        )
        expect(result).toEqual(["availableEntities:United States"])
    })

    it("formats multiple countries with AND logic (requireAll=true)", () => {
        const result = formatCountryFacetFilters(
            new Set(["United States", "China", "India"]),
            true
        )
        expect(result).toEqual([
            "availableEntities:United States",
            "availableEntities:China",
            "availableEntities:India",
        ])
    })

    it("keeps income-group-specific FMs once a country is selected", () => {
        const result = formatCountryFacetFilters(
            new Set(["United States"]),
            false
        )
        expect(result).not.toContain("isIncomeGroupSpecificFM:false")
    })
})

describe(formatFeaturedMetricFacetFilter, () => {
    it("returns filter to exclude FMs when query is non-empty", () => {
        const result = formatFeaturedMetricFacetFilter("population")
        expect(result).toEqual(["isFM:false"])
    })

    it("returns empty array when query is empty", () => {
        const result = formatFeaturedMetricFacetFilter("")
        expect(result).toEqual([])
    })

    it("returns empty array when query is only whitespace", () => {
        const result = formatFeaturedMetricFacetFilter("   ")
        expect(result).toEqual([])
    })
})

describe(formatTopicFacetFilters, () => {
    it("returns empty array when no topics provided", () => {
        const result = formatTopicFacetFilters(new Set())
        expect(result).toEqual([[]])
    })

    it("formats a single topic", () => {
        const result = formatTopicFacetFilters(new Set(["Health"]))
        expect(result).toEqual([["tags:Health"]])
    })

    it("formats multiple topics with OR logic", () => {
        const result = formatTopicFacetFilters(
            new Set(["Health", "Education", "Climate"])
        )
        expect(result).toEqual([
            ["tags:Health", "tags:Education", "tags:Climate"],
        ])
    })
})

describe(buildChartsFacetFilters, () => {
    // The site's queryCharts (site/search/queries.ts) and the public
    // /api/search's searchCharts (functions/api/search/searchApi.ts) both
    // call this directly, so this corpus is what actually guarantees they
    // build identical Algolia facetFilters for the same query + filters.
    it("browsing with no query and no filters", () => {
        const result = buildChartsFacetFilters({
            query: "",
            filters: [],
            requireAllCountries: false,
        })
        // The trailing [] is formatTopicFacetFilters's empty OR-group for "no
        // topic selected" — a no-op for Algolia, not a meaningful filter.
        expect(result).toEqual([[], "isIncomeGroupSpecificFM:false", []])
    })

    it("free-text query with no filters excludes FMs", () => {
        const result = buildChartsFacetFilters({
            query: "population",
            filters: [],
            requireAllCountries: false,
        })
        expect(result).toEqual([
            [],
            "isIncomeGroupSpecificFM:false",
            [],
            "isFM:false",
        ])
    })

    it("country + topic filters combine in country, topic order", () => {
        const result = buildChartsFacetFilters({
            query: "",
            filters: [
                { type: FilterType.COUNTRY, name: "France" },
                { type: FilterType.TOPIC, name: "Health" },
            ],
            requireAllCountries: false,
        })
        expect(result).toEqual([["availableEntities:France"], ["tags:Health"]])
    })

    it("keeps income-group FMs once a country is selected, even with a query", () => {
        const result = buildChartsFacetFilters({
            query: "gdp",
            filters: [{ type: FilterType.COUNTRY, name: "Germany" }],
            requireAllCountries: true,
        })
        expect(result).toEqual(["availableEntities:Germany", [], "isFM:false"])
        expect(result).not.toContain("isIncomeGroupSpecificFM:false")
    })

    it("appends caller-provided dataset facet filters between topic and FM", () => {
        const result = buildChartsFacetFilters({
            query: "population",
            filters: [{ type: FilterType.TOPIC, name: "Health" }],
            requireAllCountries: false,
            datasetFacetFilters: ["datasetProducers:UN"],
        })
        expect(result).toEqual([
            [],
            "isIncomeGroupSpecificFM:false",
            ["tags:Health"],
            "datasetProducers:UN",
            "isFM:false",
        ])
    })
})
