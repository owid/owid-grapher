import { expect, it, describe } from "vitest"
import {
    formatCountryFacetFilters,
    formatFeaturedMetricFacetFilter,
    formatTopicFacetFilters,
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
