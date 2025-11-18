import { describe, it, expect } from "vitest"
import {
    formatCountryFacetFilters,
    formatTopicFacetFilters,
} from "./searchApi.js"

describe("formatCountryFacetFilters", () => {
    it("returns empty array when no countries provided", () => {
        const result = formatCountryFacetFilters(new Set(), false)
        expect(result).toEqual([])
    })

    it("formats single country with OR logic (requireAll=false)", () => {
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

    it("formats single country with AND logic (requireAll=true)", () => {
        const result = formatCountryFacetFilters(
            new Set(["United States"]),
            true
        )
        expect(result).toEqual([["availableEntities:United States"]])
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
        ])
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
