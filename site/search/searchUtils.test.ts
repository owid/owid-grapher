import { expect, it, describe, beforeEach } from "vitest"
import {
    searchWithWords,
    findMatches,
    getAutocompleteSuggestionsWithUnmatchedQuery,
    createCountryFilter,
    getPaginationOffsetAndLength,
    getNbPaginatedItemsRequested,
} from "./searchUtils"

import { FilterType, SynonymMap } from "./searchTypes.js"

describe("Fuzzy search in search autocomplete", () => {
    let synonymMap: SynonymMap
    const mockCountries = [
        "United States",
        "United Kingdom",
        "Germany",
        "France",
        "China",
        "Japan",
    ]
    const mockTopics = [
        "Artificial Intelligence",
        "Climate Change",
        "Economic Growth",
        "Air Pollution",
        "Indoor Air Pollution",
        "Lead Pollution",
        "Population Growth",
        "CO2 & Greenhouse Gas Emissions",
    ]
    const sortOptions = { threshold: 0.5, limit: 3 }

    beforeEach(() => {
        // Create a mock synonym map with test data
        synonymMap = new Map([
            ["ai", ["artificial intelligence", "machine learning"]],
            ["artificial intelligence", ["ai", "machine learning"]],
            ["machine learning", ["ai", "artificial intelligence"]],
            ["co2", ["carbon dioxide", "co₂"]],
            ["carbon dioxide", ["co2", "co₂"]],
            ["co₂", ["co2", "carbon dioxide"]],
            ["us", ["united states"]],
            ["uk", ["united kingdom"]],
            ["gdp", ["economic growth"]],
            ["economic growth", ["gdp", "gdp per capita"]],
        ])
    })

    describe("searchWithWords", () => {
        it("should return original results when no synonyms exist", () => {
            const result = searchWithWords(
                ["germany"],
                mockCountries,
                mockTopics,
                new Set(),
                new Set(),
                sortOptions,
                synonymMap
            )

            expect(result.countryResults).toHaveLength(1)
            expect(result.countryResults[0].name).toBe("Germany")
            expect(result.hasResults).toBe(true)
        })

        it("should combine original and synonym results", () => {
            const result = searchWithWords(
                ["ai"],
                mockCountries,
                mockTopics,
                new Set(),
                new Set(),
                sortOptions,
                synonymMap
            )

            expect(result.topicResults.map((r) => r.name)).toContain(
                "Artificial Intelligence"
            )
            expect(result.topicResults.map((r) => r.name)).toContain(
                "Air Pollution"
            )
        })

        it("should respect the limit parameter when combining results", () => {
            // Create a scenario where synonyms would produce more results than the limit
            const largeSynonymMap = new Map([
                [
                    "test",
                    [
                        "artificial intelligence",
                        "climate change",
                        "economic growth",
                        "air pollution",
                        "population growth",
                    ],
                ],
            ])
            const limitedSortOptions = { threshold: 0.1, limit: 2 }

            const result = searchWithWords(
                ["test"],
                mockCountries,
                mockTopics,
                new Set(),
                new Set(),
                limitedSortOptions,
                largeSynonymMap
            )

            // Should not exceed the limit even with multiple synonym matches
            expect(result.topicResults.length).toBeLessThanOrEqual(2)
        })

        it("should deduplicate results and keep highest scores", () => {
            // Create a synonym map where both original and synonym could match the same result
            const duplicateSynonymMap = new Map([
                ["artificial", ["artificial intelligence"]],
            ])

            const result = searchWithWords(
                ["artificial"],
                mockCountries,
                mockTopics,
                new Set(),
                new Set(),
                sortOptions,
                duplicateSynonymMap
            )

            // Should only return "Artificial Intelligence" once, not twice
            const aiResults = result.topicResults.filter(
                (r) => r.name === "Artificial Intelligence"
            )
            expect(aiResults).toHaveLength(1)
        })

        it("should handle country synonyms correctly", () => {
            const result = searchWithWords(
                ["us"],
                mockCountries,
                mockTopics,
                new Set(),
                new Set(),
                sortOptions,
                synonymMap
            )

            expect(result.countryResults).toHaveLength(1)
            expect(result.countryResults[0].name).toBe("United States")
        })

        it("should filter out already selected countries and topics", () => {
            const selectedCountries = new Set(["United States"])
            const selectedTopics = new Set(["Artificial Intelligence"])

            const result = searchWithWords(
                ["ai"],
                mockCountries,
                mockTopics,
                selectedCountries,
                selectedTopics,
                sortOptions,
                synonymMap
            )

            expect(result.topicResults).toHaveLength(0) // AI should be filtered out
            expect(result.hasResults).toBe(false)
        })

        it("should not search topics when topics are already selected", () => {
            const selectedTopics = new Set(["Climate Change"])

            const result = searchWithWords(
                ["artificial"],
                mockCountries,
                mockTopics,
                new Set(),
                selectedTopics,
                sortOptions,
                synonymMap
            )

            expect(result.topicResults).toHaveLength(0) // No topic search when topics selected
        })

        it("should handle case-insensitive synonym matching", () => {
            const result = searchWithWords(
                ["AI"], // Uppercase
                mockCountries,
                mockTopics,
                new Set(),
                new Set(),
                sortOptions,
                synonymMap
            )

            expect(result.topicResults.map((r) => r.name)).toContain(
                "Artificial Intelligence"
            )
        })

        it("should handle multi-word synonyms", () => {
            const result = searchWithWords(
                ["carbon", "dioxide"],
                mockCountries,
                mockTopics,
                new Set(),
                new Set(),
                sortOptions,
                synonymMap
            )

            // Should match "CO2 & Greenhouse Gas Emissions" via the synonym
            expect(
                result.topicResults.some(
                    (r) => r.name === "CO2 & Greenhouse Gas Emissions"
                )
            ).toBe(true)
        })

        it("should handle empty synonym arrays", () => {
            const emptySynonymMap = new Map([["test", []]])

            const result = searchWithWords(
                ["test"],
                mockCountries,
                mockTopics,
                new Set(),
                new Set(),
                sortOptions,
                emptySynonymMap
            )

            expect(result.hasResults).toBe(false)
        })
    })

    describe("findMatches", () => {
        it("should find matches for existing countries", () => {
            const result = findMatches(
                ["germany"],
                mockCountries,
                mockTopics,
                new Set(),
                new Set(),
                sortOptions,
                synonymMap
            )

            expect(result.matchStartIndex).toBe(0) // Found match at "germany"
            expect(
                result.countryResults.some((r) => r.name === "Germany")
            ).toBe(true)
        })

        it("should find matches for existing topics", () => {
            const result = findMatches(
                ["climate", "change"],
                mockCountries,
                mockTopics,
                new Set(),
                new Set(),
                sortOptions,
                synonymMap
            )

            expect(result.matchStartIndex).toBe(0) // Found match at "climate change"
            expect(
                result.topicResults.some((r) => r.name === "Climate Change")
            ).toBe(true)
        })

        it("should ignore first words if whole query doesn't match", () => {
            const result = findMatches(
                ["climate", "change", "germany"],
                mockCountries,
                mockTopics,
                new Set(),
                new Set(),
                sortOptions,
                synonymMap
            )

            expect(result.matchStartIndex).toBe(2) // Found match at "germany"
            expect(
                result.countryResults.some((r) => r.name === "Germany")
            ).toBe(true)
        })

        it("should handle no matches found", () => {
            const result = findMatches(
                ["nonexistent", "country"],
                mockCountries,
                mockTopics,
                new Set(),
                new Set(),
                sortOptions,
                synonymMap
            )

            expect(result.matchStartIndex).toBe(2) // End of array
            expect(result.countryResults).toHaveLength(0)
            expect(result.topicResults).toHaveLength(0)
        })

        it("should work with synonyms in progressive search", () => {
            const result = findMatches(
                ["climate", "change", "ai"],
                mockCountries,
                mockTopics,
                new Set(),
                new Set(),
                sortOptions,
                synonymMap
            )

            expect(result.matchStartIndex).toBe(2) // Found match at "ai"
            expect(
                result.topicResults.some(
                    (r) => r.name === "Artificial Intelligence"
                )
            ).toBe(true)
        })
    })

    describe("getAutocompleteSuggestionsWithUnmatchedQuery", () => {
        it("should return suggestions with unmatched query", () => {
            const result = getAutocompleteSuggestionsWithUnmatchedQuery(
                "climate change germany",
                mockTopics,
                [],
                synonymMap,
                3
            )

            expect(result.unmatchedQuery).toBe("climate change")
            expect(
                result.suggestions.some(
                    (s) => s.type === FilterType.COUNTRY && s.name === "Germany"
                )
            ).toBe(true)
        })

        it("should prioritize exact matches", () => {
            // Mock perfect score
            const result = getAutocompleteSuggestionsWithUnmatchedQuery(
                "air pollution",
                mockTopics,
                [],
                synonymMap,
                3
            )
            expect(
                result.suggestions.filter((s) => s.type === FilterType.TOPIC)
            ).toHaveLength(2) // "Air Pollution" and "Indoor Air Pollution"
            expect(result.suggestions[0].name).toBe("Air Pollution")
        })

        it("should include query filter when query is provided", () => {
            const result = getAutocompleteSuggestionsWithUnmatchedQuery(
                "some query",
                mockTopics,
                [],
                synonymMap,
                3
            )

            const queryFilters = result.suggestions.filter(
                (s) => s.type === FilterType.QUERY
            )
            expect(queryFilters).toHaveLength(1)
            expect(queryFilters[0].name).toBe("some query")
        })

        it("should exclude already selected filters", () => {
            const existingFilters = [createCountryFilter("Germany")]

            const result = getAutocompleteSuggestionsWithUnmatchedQuery(
                "germany",
                mockTopics,
                existingFilters,
                synonymMap,
                3
            )

            // Should not suggest Germany or Climate Change again
            expect(result.suggestions.some((s) => s.name === "Germany")).toBe(
                false
            )
        })

        it("should work with synonym-based suggestions", () => {
            const result = getAutocompleteSuggestionsWithUnmatchedQuery(
                "ai",
                mockTopics,
                [],
                synonymMap,
                3
            )

            // Should suggest "Artificial Intelligence" via the "ai" synonym
            expect(
                result.suggestions.some(
                    (s) => s.name === "Artificial Intelligence"
                )
            ).toBe(true)
        })

        it("should stop progressing through the query when finding results", () => {
            const result = getAutocompleteSuggestionsWithUnmatchedQuery(
                "air pollution",
                mockTopics,
                [],
                synonymMap,
                5
            )

            // Should match "Air Pollution", "Indoor Air Pollution" but not "Lead Pollution"
            const airPollutionMatches = result.suggestions.filter((s) =>
                s.name.includes("Air Pollution")
            )
            const leadPollutionMatches = result.suggestions.filter(
                (s) => s.name === "Lead Pollution"
            )

            expect(airPollutionMatches.length).toBeGreaterThan(0)
            expect(leadPollutionMatches).toHaveLength(0)
        })
    })

    it("should handle special characters in queries", () => {
        const result = getAutocompleteSuggestionsWithUnmatchedQuery(
            "CO₂",
            mockTopics,
            [],
            synonymMap,
            3
        )

        // Should handle the unicode character gracefully
        expect(
            result.suggestions.some(
                (s) => s.name === "CO2 & Greenhouse Gas Emissions"
            )
        ).toBe(true)
    })

    it("should handle queries with multiple spaces", () => {
        const result = getAutocompleteSuggestionsWithUnmatchedQuery(
            "climate    change     germany",
            mockTopics,
            [],
            synonymMap,
            3
        )

        expect(result.suggestions.some((s) => s.name === "Germany")).toBe(true)
    })
})

describe("offset pagination for useInfiniteSearchOffset hook", () => {
    it("computes offsets and lengths for first and later pages", () => {
        expect(getPaginationOffsetAndLength(0, 3, 6)).toEqual({
            offset: 0,
            length: 3,
        })
        expect(getPaginationOffsetAndLength(1, 3, 6)).toEqual({
            offset: 3,
            length: 6,
        })
        expect(getPaginationOffsetAndLength(2, 3, 6)).toEqual({
            offset: 9,
            length: 6,
        })
    })

    it("computes number of requested items correctly", () => {
        expect(getNbPaginatedItemsRequested(0, 3, 6, 3)).toBe(3)
        expect(getNbPaginatedItemsRequested(1, 3, 6, 6)).toBe(9)
        expect(getNbPaginatedItemsRequested(2, 3, 6, 2)).toBe(11)
    })
})
