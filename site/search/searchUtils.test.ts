import { expect, it, describe, beforeEach } from "vitest"
import {
    findTopicAndRegionFilters,
    suggestFiltersFromQuerySuffix,
    getPaginationOffsetAndLength,
    getNbPaginatedItemsRequested,
    removeMatchedWordsWithStopWords,
    createTopicFilter,
    extractFiltersFromQuery,
    createCountryFilter,
} from "./searchUtils"

import { FilterType, SynonymMap } from "./searchTypes.js"
import { listedRegionsNames } from "@ourworldindata/utils"

describe("Fuzzy search in search autocomplete", () => {
    let synonymMap: SynonymMap
    const regions = listedRegionsNames()
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

    const sortOptionsMultiple = { threshold: 0.75, limit: 3 }
    const sortOptionsSingle = { threshold: 0.75, limit: 1 }

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

    describe("findTopicAndRegionFilters", () => {
        it("should return original results when no synonyms exist", () => {
            const result = findTopicAndRegionFilters(
                ["france"],
                regions,
                mockTopics,
                new Set(),
                new Set(),
                synonymMap,
                sortOptionsMultiple
            )

            const countryResults = result.filter(
                (f) => f.type === FilterType.COUNTRY
            )
            expect(countryResults).toHaveLength(1)
            expect(countryResults[0].name).toBe("France")
        })

        it("should combine original and synonym results", () => {
            const result = findTopicAndRegionFilters(
                ["ai"],
                regions,
                mockTopics,
                new Set(),
                new Set(),
                synonymMap,
                sortOptionsMultiple
            )

            const topicResults = result.filter(
                (f) => f.type === FilterType.TOPIC
            )
            expect(topicResults.map((r) => r.name)).toContain(
                "Artificial Intelligence"
            )
            expect(topicResults.map((r) => r.name)).toContain("Air Pollution")
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

            const result = findTopicAndRegionFilters(
                ["test"],
                regions,
                mockTopics,
                new Set(),
                new Set(),
                largeSynonymMap,
                limitedSortOptions
            )

            // Should not exceed the limit even with multiple synonym matches
            const topicResults = result.filter(
                (f) => f.type === FilterType.TOPIC
            )
            expect(topicResults.length).toBeLessThanOrEqual(2)
        })

        it("should deduplicate results and keep highest scores", () => {
            // Create a synonym map where both original and synonym could match the same result
            const duplicateSynonymMap = new Map([
                ["artificial", ["artificial intelligence"]],
            ])

            const result = findTopicAndRegionFilters(
                ["artificial"],
                regions,
                mockTopics,
                new Set(),
                new Set(),
                duplicateSynonymMap,
                sortOptionsMultiple
            )

            // Should only return "Artificial Intelligence" once, not twice
            const aiResults = result.filter(
                (r) => r.name === "Artificial Intelligence"
            )
            expect(aiResults).toHaveLength(1)
        })

        it("should expand country synonyms (variant names)", () => {
            const result = findTopicAndRegionFilters(
                ["us"],
                regions,
                mockTopics,
                new Set(),
                new Set(),
                synonymMap,
                sortOptionsMultiple
            )

            const countryResults = result.filter(
                (f) => f.type === FilterType.COUNTRY
            )
            expect(countryResults[0].name).toBe("United States")
        })

        it("should filter out already selected countries and topics", () => {
            const selectedCountries = new Set(["United States"])
            const selectedTopics = new Set(["Artificial Intelligence"])

            const topicResults = findTopicAndRegionFilters(
                ["ai"],
                regions,
                mockTopics,
                selectedCountries,
                selectedTopics,
                synonymMap,
                sortOptionsMultiple
            )

            expect(
                topicResults
                    .map((r) => r.name)
                    .some((name) => name === "Artificial Intelligence")
            ).toBe(false) // AI should be filtered out

            const countryResults = findTopicAndRegionFilters(
                ["us"],
                regions,
                mockTopics,
                selectedCountries,
                selectedTopics,
                synonymMap,
                sortOptionsMultiple
            )
            expect(
                countryResults
                    .map((r) => r.name)
                    .some((name) => name === "United States")
            ).toBe(false) // US should be excluded
        })

        it("should handle case-insensitive synonym matching", () => {
            const result = findTopicAndRegionFilters(
                ["AI"], // Uppercase
                regions,
                mockTopics,
                new Set(),
                new Set(),
                synonymMap,
                sortOptionsMultiple
            )

            const topicResults = result.filter(
                (f) => f.type === FilterType.TOPIC
            )
            expect(topicResults.map((r) => r.name)).toContain(
                "Artificial Intelligence"
            )
        })

        it("should handle multi-word synonyms", () => {
            const result = findTopicAndRegionFilters(
                ["carbon", "dioxide"],
                regions,
                mockTopics,
                new Set(),
                new Set(),
                synonymMap,
                sortOptionsMultiple
            )

            // Should match "CO2 & Greenhouse Gas Emissions" via the synonym
            const topicResults = result.filter(
                (f) => f.type === FilterType.TOPIC
            )
            expect(
                topicResults.some(
                    (r) => r.name === "CO2 & Greenhouse Gas Emissions"
                )
            ).toBe(true)
        })

        it("should handle empty synonym arrays", () => {
            const emptySynonymMap = new Map([["test", []]])

            const result = findTopicAndRegionFilters(
                ["test"],
                regions,
                mockTopics,
                new Set(),
                new Set(),
                emptySynonymMap,
                sortOptionsMultiple
            )

            expect(result.length).toBe(0)
        })
    })

    describe("extractFiltersFromQuery", () => {
        it("should handle multiple non-overlapping matches", () => {
            const result = extractFiltersFromQuery(
                "united states climate change",
                regions,
                mockTopics,
                [],
                sortOptionsSingle,
                synonymMap
            )

            // Should find both "United States" and "Climate Change"
            expect(result).toHaveLength(2)
            const names = result.map((r) => r.name).sort()
            expect(names).toEqual(["Climate Change", "United States"])
        })

        it("should find the longest matches in overlapping scenarios", () => {
            // Create a complex scenario with multiple overlapping possibilities
            const complexTopics = [
                "Air",
                "Pollution",
                "Air Pollution",
                "Indoor Air",
                "Indoor Air Pollution",
                "Climate",
                "Climate Change",
            ]

            const result = extractFiltersFromQuery(
                "indoor air pollution climate change",
                regions,
                complexTopics,
                [],
                sortOptionsSingle,
                synonymMap
            )

            // Should get the longest matches: "Indoor Air Pollution" and "Climate Change"
            expect(result).toHaveLength(2)
            const names = result.map((r) => r.name)
            expect(names).toEqual(["Indoor Air Pollution", "Climate Change"])
        })

        it("should deduplicate identical matches", () => {
            // Create a scenario where the same entity could be matched multiple times
            // "united sta" (partial match) vs "united states" (exact match)
            const result = extractFiltersFromQuery(
                "united sta france united states", // Adding another country to prevent the whole query to fuzzy match
                regions,
                mockTopics,
                [],
                sortOptionsSingle,
                synonymMap
            )

            expect(result).toHaveLength(2)
            expect(result[0].name).toBe("United States")
            expect(result[1].name).toBe("France")
        })

        it("should work with synonyms", () => {
            const result = extractFiltersFromQuery(
                "ai in the us",
                regions,
                mockTopics,
                [],
                sortOptionsSingle,
                synonymMap
            )

            expect(result).toHaveLength(2)
            expect(result[0].name).toBe("Artificial Intelligence")
            expect(result[1].name).toBe("United States")
        })

        it("should filter out stop words from n-grams", () => {
            const result = extractFiltersFromQuery(
                "artificial intelligence in the united states",
                regions,
                mockTopics,
                [],
                sortOptionsSingle,
                synonymMap
            )

            expect(result).toHaveLength(2)
            expect(result[0].name).toBe("Artificial Intelligence")
            expect(result[1].name).toBe("United States")
            // Check that original positions take stop words into account
            expect(result[0].positions).toEqual([0, 1])
            expect(result[1].positions).toEqual([4, 5])
        })

        it("should handle stop words at beginning of the query", () => {
            const result = extractFiltersFromQuery(
                "the united states of america",
                regions,
                mockTopics,
                [],
                sortOptionsSingle,
                synonymMap
            )

            const usResult = result.find((r) => r.name === "United States")

            expect(usResult).toBeDefined()
            // Should match positions [1, 2] (skipping "the" at start)
            expect(usResult?.positions).toEqual([1, 2])
        })

        it("should filter out already selected countries and topics", () => {
            const result = extractFiltersFromQuery(
                "united states artificial intelligence",
                regions,
                mockTopics,
                [
                    createCountryFilter("United States"),
                    createTopicFilter("Artificial Intelligence"),
                ],
                sortOptionsSingle,
                synonymMap
            )

            // Should not return already selected items
            expect(result).toHaveLength(0)
        })

        it("should only return exact matches when asked", () => {
            const result = extractFiltersFromQuery(
                "east germany",
                ["East Timor", "Germany"],
                mockTopics,
                [],
                { threshold: 1, limit: 1 },
                synonymMap
            )

            // Should only return "Germany", since "east" doesn't exactly match "East Timor"
            expect(result).toHaveLength(1)
            expect(result[0].name).toBe("Germany")
        })

        it("should return partial matches", () => {
            const testCountries: string[] = []
            const testTopics = [
                "Consumption",
                "Economic Growth",
                "Climate Change",
            ]

            // Test that "Coption" doesn't match "Consumption" (partial word match)
            const result = extractFiltersFromQuery(
                "Economic",
                testCountries,
                testTopics,
                [],
                sortOptionsSingle,
                synonymMap
            )
            expect(result.map((r) => r.name)).toEqual(["Economic Growth"])
        })
    })

    describe("removeMatchedWordsWithStopWords", () => {
        it("should remove matched words and preceding stop words", () => {
            const words = [
                "artificial",
                "intelligence",
                "in",
                "the",
                "united",
                "states",
            ]
            // Remove "united states" at positions [4, 5]
            const result = removeMatchedWordsWithStopWords(words, [4, 5])

            // Should remove "united states" and preceding stop words "in the"
            expect(result).toBe("artificial intelligence")
        })

        it("should handle repeated consecutive stop words", () => {
            const words = [
                "climate",
                "change",
                "the",
                "the",
                "in",
                "in",
                "united",
                "states",
            ]
            // Remove "united states" at positions [6, 7]
            const result = removeMatchedWordsWithStopWords(words, [6, 7])

            expect(result).toBe("climate change")
        })

        it("should handle repeated groups of matched positions and stop words", () => {
            const words = [
                "climate",
                "change",
                "in",
                "the",
                "united",
                "states",
                "and",
                "the",
                "uk",
            ]

            const result = removeMatchedWordsWithStopWords(words, [4, 5, 8])
            expect(result).toBe("climate change")
        })

        it("should not remove stop words that are not preceding the match", () => {
            const words = [
                "of",
                "climate",
                "change",
                "in",
                "the",
                "united",
                "states",
                "and",
            ]
            // Remove "united states" at positions [5, 6]
            const result = removeMatchedWordsWithStopWords(words, [5, 6])

            // Should NOT remove stop words at beginning or after the match
            expect(result).toBe("of climate change and")
        })

        it("should handle empty matched positions", () => {
            const words = ["climate", "change"]
            const result = removeMatchedWordsWithStopWords(words, [])

            expect(result).toBe("climate change")
        })

        it("should handle match at beginning of array", () => {
            const words = ["united", "states", "climate", "change"]
            // Remove "united states" at positions [0, 1]
            const result = removeMatchedWordsWithStopWords(words, [0, 1])

            // No preceding stop words to remove
            expect(result).toBe("climate change")
        })
    })

    describe("suggestFiltersFromQuerySuffix", () => {
        it("should find matches for existing topics", () => {
            const result = suggestFiltersFromQuerySuffix(
                "pollution",
                regions,
                mockTopics,
                [],
                synonymMap
            )
            expect(
                result.suggestions.some((s) => s.name === "Air Pollution")
            ).toBe(true)
        })

        it("should return suggestions with unmatched query", () => {
            const result = suggestFiltersFromQuerySuffix(
                "climate change pollution",
                regions,
                mockTopics,
                [],
                synonymMap
            )

            expect(result.unmatchedQuery).toBe("climate change")
            expect(
                result.suggestions.some(
                    (s) =>
                        s.type === FilterType.TOPIC &&
                        s.name === "Air Pollution"
                )
            ).toBe(true)
        })

        it("should prioritize exact matches", () => {
            // Mock perfect score
            const result = suggestFiltersFromQuerySuffix(
                "air pollution",
                regions,
                mockTopics,
                [],
                synonymMap
            )
            expect(
                result.suggestions.filter((s) => s.type === FilterType.TOPIC)
            ).toHaveLength(2) // "Air Pollution" and "Indoor Air Pollution"
            expect(result.suggestions[0].name).toBe("Air Pollution")
        })

        it("should include query filter when query is provided", () => {
            const result = suggestFiltersFromQuerySuffix(
                "some query",
                regions,
                mockTopics,
                [],
                synonymMap
            )

            const queryFilters = result.suggestions.filter(
                (s) => s.type === FilterType.QUERY
            )
            expect(queryFilters).toHaveLength(1)
            expect(queryFilters[0].name).toBe("some query")
        })

        it("should exclude already selected filters", () => {
            const existingFilters = [createTopicFilter("Air Pollution")]

            const result = suggestFiltersFromQuerySuffix(
                "air pollution",
                regions,
                mockTopics,
                existingFilters,
                synonymMap
            )

            // Should not suggest Air Pollution
            expect(
                result.suggestions.some((s) => s.name === "Air Pollution")
            ).toBe(false)
        })

        it("should not suggest exact country matches", () => {
            const result = suggestFiltersFromQuerySuffix(
                "france",
                regions,
                mockTopics,
                [],
                synonymMap
            )

            // Should not suggest France as it's an exact match and handled by automatic filters
            expect(result.suggestions.some((s) => s.name === "France")).toBe(
                false
            )
        })

        it("should suggest partial country matches", () => {
            const result = suggestFiltersFromQuerySuffix(
                "franc", //missing final "e"
                regions,
                mockTopics,
                [],
                synonymMap
            )

            expect(result.suggestions.some((s) => s.name === "France")).toBe(
                true
            )
        })

        it("should surface synonym-based suggestions", () => {
            const result = suggestFiltersFromQuerySuffix(
                "climate change ai",
                regions,
                mockTopics,
                [],
                synonymMap
            )

            // Should suggest "Artificial Intelligence" via the "ai" synonym
            expect(
                result.suggestions.some(
                    (s) => s.name === "Artificial Intelligence"
                )
            ).toBe(true)
        })

        it("should stop progressing through the query when finding results", () => {
            const result = suggestFiltersFromQuerySuffix(
                "air pollution",
                regions,
                mockTopics,
                [],
                synonymMap
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

        it("should filter out historical regions while preventing contained country suggestions", () => {
            const result = suggestFiltersFromQuerySuffix(
                "east germany",
                regions,
                mockTopics,
                [],
                synonymMap
            )

            // Should not suggest "East Germany" (historical region filtered out)
            expect(
                result.suggestions.some((s) => s.name === "East Germany")
            ).toBe(false)

            // Should not suggest "Germany" either (iteration stopped when "East Germany" was found)
            expect(result.suggestions.some((s) => s.name === "Germany")).toBe(
                false
            )

            // Should include the query as a search filter since no valid country suggestions were found
            expect(
                result.suggestions.some(
                    (s) =>
                        s.type === FilterType.QUERY && s.name === "east germany"
                )
            ).toBe(true)
        })

        it("should handle special characters in queries", () => {
            const result = suggestFiltersFromQuerySuffix(
                "CO₂",
                regions,
                mockTopics,
                [],
                synonymMap
            )

            // Should handle the unicode character gracefully
            expect(
                result.suggestions.some(
                    (s) => s.name === "CO2 & Greenhouse Gas Emissions"
                )
            ).toBe(true)
        })

        it("should handle queries with multiple spaces, including leading and trailing", () => {
            const result = suggestFiltersFromQuerySuffix(
                "  climate    change     air pollution  ",
                regions,
                mockTopics,
                [],
                synonymMap
            )

            expect(
                result.suggestions.some((s) => s.name === "Air Pollution")
            ).toBe(true)
        })

        it("should handle queries returning no matches", () => {
            const result = suggestFiltersFromQuerySuffix(
                "nonexistenttopic",
                regions,
                mockTopics,
                [],
                synonymMap
            )

            expect(result.suggestions).toHaveLength(1) // Only the query filter
            expect(result.suggestions[0].type).toBe(FilterType.QUERY)
            expect(result.unmatchedQuery).toBe("nonexistenttopic")
        })
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
