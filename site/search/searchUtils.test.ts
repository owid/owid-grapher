import { expect, it, describe, beforeEach } from "vitest"
import {
    searchWithWords,
    findMatches,
    findMatchesWithNgrams,
    getFilterSuggestionsWithUnmatchedQuery,
    createCountryFilter,
    getPaginationOffsetAndLength,
    getNbPaginatedItemsRequested,
    removeMatchedWordsWithStopWords,
    calculateScore,
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

    const sortOptions = { threshold: 0.75, limit: 3 }

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

            const countryResults = result.filter(
                (f) => f.type === FilterType.COUNTRY
            )
            expect(countryResults).toHaveLength(1)
            expect(countryResults[0].name).toBe("Germany")
            expect(result.length > 0).toBe(true)
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
            const aiResults = result.filter(
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

            const countryResults = result.filter(
                (f) => f.type === FilterType.COUNTRY
            )
            expect(countryResults).toHaveLength(1)
            expect(countryResults[0].name).toBe("United States")
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

            const topicResults = result.filter(
                (f) => f.type === FilterType.TOPIC
            )
            expect(topicResults).toHaveLength(0) // AI should be filtered out
            expect(result.length).toBe(0)
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

            const topicResults = result.filter(
                (f) => f.type === FilterType.TOPIC
            )
            expect(topicResults).toHaveLength(0) // No topic search when topics selected
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

            const topicResults = result.filter(
                (f) => f.type === FilterType.TOPIC
            )
            expect(topicResults.map((r) => r.name)).toContain(
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

            const result = searchWithWords(
                ["test"],
                mockCountries,
                mockTopics,
                new Set(),
                new Set(),
                sortOptions,
                emptySynonymMap
            )

            expect(result.length).toBe(0)
        })
    })

    describe("findMatchesWithNgrams", () => {
        it("should handle multiple non-overlapping matches", () => {
            const result = findMatchesWithNgrams(
                ["united", "states", "climate", "change"],
                mockCountries,
                mockTopics,
                new Set(),
                new Set(),
                synonymMap
            )

            // Should find both "United States" and "Climate Change"
            expect(result).toHaveLength(2)
            const names = result.map((r) => r.name).sort()
            expect(names).toEqual(["Climate Change", "United States"])
        })

        it("should prevent overlapping n-grams correctly", () => {
            // Test that when "Indoor Air Pollution" is matched as a 3-gram,
            // "Air Pollution" is not matched
            const result = findMatchesWithNgrams(
                ["indoor", "air", "pollution"],
                mockCountries,
                mockTopics,
                new Set(),
                new Set(),
                synonymMap
            )

            // Should match "Indoor Air Pollution" (3-gram)
            // Should NOT match "Air Pollution" separately since those positions are already taken
            expect(result).toHaveLength(1)
            const names = result.map((r) => r.name)
            expect(names).toEqual(["Indoor Air Pollution"])
        })

        it("should deduplicate identical matches", () => {
            // Create a scenario where the same entity could be matched multiple times
            // "united sta" (partial match) vs "united states" (exact match)
            const result = findMatchesWithNgrams(
                ["united", "sta", "france", "united", "states"], // Adding another country to prevent the whole query to fuzzy match
                mockCountries,
                mockTopics,
                new Set(),
                new Set(),
                synonymMap
            )

            expect(result).toHaveLength(2)
            expect(result[0].name).toBe("United States")
            expect(result[1].name).toBe("France")
        })

        it("should work with synonyms", () => {
            const result = findMatchesWithNgrams(
                ["ai", "in", "the", "us"],
                mockCountries,
                mockTopics,
                new Set(),
                new Set(),
                synonymMap
            )

            expect(result).toHaveLength(2)
            expect(result[0].name).toBe("Artificial Intelligence")
            expect(result[1].name).toBe("United States")
        })

        it("should filter out stop words from n-grams", () => {
            const result = findMatchesWithNgrams(
                ["artificial", "intelligence", "in", "the", "united", "states"],
                mockCountries,
                mockTopics,
                new Set(),
                new Set(),
                synonymMap
            )

            expect(result).toHaveLength(2)
            expect(result[0].name).toBe("Artificial Intelligence")
            expect(result[1].name).toBe("United States")
            // Check that original positions take stop words into account
            expect(result[0].originalPositions).toEqual([0, 1])
            expect(result[1].originalPositions).toEqual([4, 5])
        })

        it("should handle stop words at beginning and end", () => {
            const result = findMatchesWithNgrams(
                ["the", "united", "states", "of", "america"],
                ["United States", ...mockCountries],
                mockTopics,
                new Set(),
                new Set(),
                synonymMap
            )

            expect(result).toHaveLength(1)
            expect(result[0].name).toBe("United States")
            // Should match positions [1, 2] (skipping "the" at start)
            expect(result[0].originalPositions).toEqual([1, 2])
        })

        it("should filter out already selected countries and topics", () => {
            const selectedCountries = new Set(["United States"])
            const selectedTopics = new Set(["Artificial Intelligence"])

            const result = findMatchesWithNgrams(
                ["united", "states", "artificial", "intelligence"],
                mockCountries,
                mockTopics,
                selectedCountries,
                selectedTopics,
                synonymMap
            )

            // Should not return already selected items
            const names = result.map((r) => r.name)
            expect(names).toEqual(["United Kingdom"])
        })

        it("should find the longest matches in complex overlapping scenarios", () => {
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

            const result = findMatchesWithNgrams(
                ["indoor", "air", "pollution", "climate", "change"],
                mockCountries,
                complexTopics,
                new Set(),
                new Set(),
                synonymMap
            )

            // Should get the longest matches: "Indoor Air Pollution" and "Climate Change"
            expect(result).toHaveLength(2)
            const names = result.map((r) => r.name)
            expect(names).toEqual(["Indoor Air Pollution", "Climate Change"])
        })

        it("should not match non-contiguous partial-word substrings", () => {
            const testCountries: string[] = []
            const testTopics = [
                "Consumption",
                "Economic Growth",
                "Climate Change",
            ]

            // Test that "Coption" doesn't match "Consumption" (partial word match)
            const result = findMatchesWithNgrams(
                ["Coption"],
                testCountries,
                testTopics,
                new Set(),
                new Set(),
                synonymMap
            )
            expect(result).toHaveLength(0)
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
            const countryResults = result.filters.filter(
                (f) => f.type === FilterType.COUNTRY
            )
            expect(countryResults.some((r) => r.name === "Germany")).toBe(true)
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
            const topicResults = result.filters.filter(
                (f) => f.type === FilterType.TOPIC
            )
            expect(topicResults.some((r) => r.name === "Climate Change")).toBe(
                true
            )
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
            const countryResults = result.filters.filter(
                (f) => f.type === FilterType.COUNTRY
            )
            expect(countryResults.some((r) => r.name === "Germany")).toBe(true)
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
            const countryResults = result.filters.filter(
                (f) => f.type === FilterType.COUNTRY
            )
            const topicResults = result.filters.filter(
                (f) => f.type === FilterType.TOPIC
            )
            expect(countryResults).toHaveLength(0)
            expect(topicResults).toHaveLength(0)
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
            const topicResults = result.filters.filter(
                (f) => f.type === FilterType.TOPIC
            )
            expect(
                topicResults.some((r) => r.name === "Artificial Intelligence")
            ).toBe(true)
        })
    })

    describe("getAutocompleteSuggestionsWithUnmatchedQuery", () => {
        it("should return suggestions with unmatched query", () => {
            const result = getFilterSuggestionsWithUnmatchedQuery(
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
            const result = getFilterSuggestionsWithUnmatchedQuery(
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
            const result = getFilterSuggestionsWithUnmatchedQuery(
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

            const result = getFilterSuggestionsWithUnmatchedQuery(
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
            const result = getFilterSuggestionsWithUnmatchedQuery(
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
            const result = getFilterSuggestionsWithUnmatchedQuery(
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
        const result = getFilterSuggestionsWithUnmatchedQuery(
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
        const result = getFilterSuggestionsWithUnmatchedQuery(
            "climate    change     germany",
            mockTopics,
            [],
            synonymMap,
            3
        )

        expect(result.suggestions.some((s) => s.name === "Germany")).toBe(true)
    })

    describe("calculateScore function", () => {
        it("should rank countries by query match quality for 'united'", () => {
            const query = ["united"]
            const countries = [
                "United States",
                "United Kingdom",
                "United Arab Emirates",
            ]

            const scores = countries.map((country) => ({
                name: country,
                score: calculateScore(query, country),
            }))

            // Verify ordering: shorter targets score higher for same query
            // "united" should score higher for shorter country names since it covers more of the target
            expect(scores[0].score).toBeGreaterThan(scores[1].score)
            expect(scores[1].score).toBeGreaterThan(scores[2].score)
        })

        it("should rank topics by multi-word query match quality for 'child mortality'", () => {
            const query = ["child", "mortality"]
            const topics = [
                "Child and Infant Mortality",
                "Child Mortality Rate",
                "Maternal Mortality",
                "Population Growth",
            ]

            const scores = topics.map((topic) => ({
                name: topic,
                score: calculateScore(query, topic),
            }))

            expect(scores[1].score).toBeGreaterThan(scores[0].score)
        })

        it("should handle partial word matches correctly for ranking", () => {
            const query = ["eco"]
            const topics = [
                "Economic Growth",
                "Economics",
                "Ecology",
                "Climate Change",
            ]

            const scores = topics.map((topic) => ({
                name: topic,
                score: calculateScore(query, topic),
            }))

            expect(scores[2].score).toBeGreaterThan(scores[1].score)
            expect(scores[1].score).toBeGreaterThan(scores[0].score)
        })

        it("should handle case-insensitive matching across multiple targets", () => {
            const query = ["UNITED"]
            const countries = [
                "United States",
                "united kingdom",
                "UNITED ARAB EMIRATES",
            ]

            const scores = countries.map((country) =>
                calculateScore(query, country)
            )

            expect(scores[0]).toBeGreaterThan(scores[1])
            expect(scores[1]).toBeGreaterThan(scores[2])
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
