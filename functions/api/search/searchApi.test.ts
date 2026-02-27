import { describe, it, expect } from "vitest"
import {
    formatCountryFacetFilters,
    formatFeaturedMetricFacetFilter,
    formatTopicFacetFilters,
} from "./searchApi.js"

describe("formatCountryFacetFilters", () => {
    it("returns empty array when no countries provided", () => {
        const result = formatCountryFacetFilters(new Set(), false)
        expect(result).toEqual([["isIncomeGroupSpecificFM:false"]])
    })

    it("formats single country with OR logic (requireAll=false)", () => {
        const result = formatCountryFacetFilters(
            new Set(["United States"]),
            false
        )
        expect(result).toEqual([
            ["availableEntities:United States"],
            ["isIncomeGroupSpecificFM:false"],
        ])
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
            ["isIncomeGroupSpecificFM:false"],
        ])
    })

    it("formats single country with AND logic (requireAll=true)", () => {
        const result = formatCountryFacetFilters(
            new Set(["United States"]),
            true
        )
        expect(result).toEqual([
            ["availableEntities:United States"],
            ["isIncomeGroupSpecificFM:false"],
        ])
    })

    it("formats multiple countries with AND logic (requireAll=true)", () => {
        const result = formatCountryFacetFilters(
            new Set(["United States", "China", "India"]),
            true
        )
        expect(result).toEqual([
            ["availableEntities:United States"],
            ["availableEntities:China"],
            ["availableEntities:India"],
            ["isIncomeGroupSpecificFM:false"],
        ])
    })
})

describe("formatFeaturedMetricFacetFilter", () => {
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

describe("formatTopicFacetFilters", () => {
    it("returns empty array when no topics provided", () => {
        const result = formatTopicFacetFilters(new Set())
        expect(result).toEqual([])
    })

    it("formats single topic", () => {
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
