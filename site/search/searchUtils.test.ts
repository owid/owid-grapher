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
    sortHitsByBaselineOrder,
    resolveSelectedChartIndex,
    getChartHitIdentity,
    getVisibleChartHits,
    hasHiddenChartHits,
    filterChartHitsByQueryWords,
    textContainsAllQueryWords,
    splitTextByQueryWordMatches,
    getDuplicatedChartTitles,
    getChartHitVariantName,
    ALL_CHARTS_INITIAL_ROW_COUNT,
    capSuggestedSearches,
    ALL_CHARTS_MAX_SUGGESTED_SEARCHES,
} from "./searchUtils"

import { FilterType, SynonymMap } from "@ourworldindata/types"
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
    const sortOptionsSingleExact = { threshold: 1, limit: 1 }

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

    describe(findTopicAndRegionFilters, () => {
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

    describe(extractFiltersFromQuery, () => {
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
                sortOptionsSingleExact,
                synonymMap
            )

            // Should only return "Germany", since "east" doesn't exactly match "East Timor"
            expect(result).toHaveLength(1)
            expect(result[0].name).toBe("Germany")
        })

        it("should exactly match countries containing stop words", () => {
            const result = extractFiltersFromQuery(
                "trinidad and tobago",
                regions,
                mockTopics,
                [],
                sortOptionsSingleExact,
                synonymMap
            )

            expect(result).toHaveLength(1)
            expect(result[0].name).toBe("Trinidad and Tobago")
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

    describe(removeMatchedWordsWithStopWords, () => {
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

    describe(suggestFiltersFromQuerySuffix, () => {
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

describe(getChartHitIdentity, () => {
    it("ignores objectID, so a Featured Metric record and the plain record for the same chart share an identity", () => {
        // Real records from the CO2 topic: the empty-query result set is served
        // the FM record, every result set after the first keystroke the plain
        // one, and both render as the same row.
        const featuredMetricRecord = {
            objectID: "486-fm-upper-middle-co2-greenhouse-gas-emissions",
            slug: "co-emissions-per-capita",
        }
        const plainRecord = {
            objectID: "486",
            slug: "co-emissions-per-capita",
        }
        expect(getChartHitIdentity(featuredMetricRecord)).toBe(
            getChartHitIdentity(plainRecord)
        )
    })

    it("distinguishes views that share a slug by their queryParams", () => {
        // Explorer/mdim views all live under one slug.
        const viewA = { slug: "energy", queryParams: "?tab=chart&x=1" }
        const viewB = { slug: "energy", queryParams: "?tab=chart&x=2" }
        expect(getChartHitIdentity(viewA)).not.toBe(getChartHitIdentity(viewB))
    })

    it("treats a missing queryParams as empty", () => {
        expect(getChartHitIdentity({ slug: "life-expectancy" })).toBe(
            getChartHitIdentity({
                slug: "life-expectancy",
                queryParams: undefined,
            })
        )
    })
})

describe(sortHitsByBaselineOrder, () => {
    // The all-charts block's default order: the unfiltered, topic-only result
    // set. Every filtered result set must read as a subsequence of this.
    const baseline = ["a", "b", "c", "d", "e", "f"].map((slug) => ({ slug }))

    const slugs = (hits: { slug: string }[]): string[] =>
        hits.map((hit) => hit.slug)

    it("restores the baseline order of a relevance-ordered result set", () => {
        // What Algolia hands back for some query: the same charts, re-ranked.
        const relevanceOrdered = ["e", "a", "d", "b"].map((slug) => ({ slug }))
        expect(
            slugs(sortHitsByBaselineOrder(relevanceOrdered, baseline))
        ).toEqual(["a", "b", "d", "e"])
    })

    it("produces a subsequence of the baseline for every permutation of a filtered set", () => {
        // Whatever order the hits arrive in, the output is the same
        // baseline-ordered list — so consecutive keystrokes returning the same
        // set in different orders can't reshuffle the rows.
        const subset = ["b", "c", "f"]
        const permutations = [
            ["b", "c", "f"],
            ["b", "f", "c"],
            ["c", "b", "f"],
            ["c", "f", "b"],
            ["f", "b", "c"],
            ["f", "c", "b"],
        ]
        for (const permutation of permutations) {
            const sorted = slugs(
                sortHitsByBaselineOrder(
                    permutation.map((slug) => ({ slug })),
                    baseline
                )
            )
            expect(sorted).toEqual(subset)
            // ...and that is genuinely a subsequence of the baseline.
            expect(
                slugs(baseline).filter((slug) => sorted.includes(slug))
            ).toEqual(sorted)
        }
    })

    it("keeps a chart at its baseline position when the query swaps its Featured Metric record for the plain one", () => {
        // The bug this ordering rule exists to prevent, with the real records
        // behind it. The unfiltered set that defines the default order is
        // served FM records for the first few charts; the filtered set for
        // "china" is served their plain twins, which carry different
        // objectIDs. Keyed on objectID those three look like brand-new rows
        // and get flung to the bottom of a 165-row list, which is what read as
        // the top charts vanishing.
        const defaultOrder = [
            {
                objectID: "486-fm-upper-middle-co2-greenhouse-gas-emissions",
                slug: "co-emissions-per-capita",
            },
            {
                objectID: "488-fm-upper-middle-co2-greenhouse-gas-emissions",
                slug: "annual-co2-emissions-per-country",
            },
            {
                objectID: "1895-fm-upper-middle-co2-greenhouse-gas-emissions",
                slug: "temperature-anomaly",
            },
            {
                objectID: "4146-fm-upper-middle-co2-greenhouse-gas-emissions",
                slug: "ghg-emissions-by-sector",
            },
            { objectID: "547", slug: "annual-co2-emissions-by-region" },
            { objectID: "558", slug: "meat-supply-vs-gdp-per-capita" },
        ]
        // What Algolia returns for "china": no FM records (isFM:false), the
        // plain twins instead, in relevance order, and temperature-anomaly
        // legitimately absent since it has no China data.
        const chinaResults = [
            { objectID: "547", slug: "annual-co2-emissions-by-region" },
            { objectID: "4146", slug: "ghg-emissions-by-sector" },
            { objectID: "486", slug: "co-emissions-per-capita" },
            { objectID: "558", slug: "meat-supply-vs-gdp-per-capita" },
            { objectID: "488", slug: "annual-co2-emissions-per-country" },
        ]
        expect(
            slugs(sortHitsByBaselineOrder(chinaResults, defaultOrder))
        ).toEqual([
            "co-emissions-per-capita",
            "annual-co2-emissions-per-country",
            "ghg-emissions-by-sector",
            "annual-co2-emissions-by-region",
            "meat-supply-vs-gdp-per-capita",
        ])
    })

    it("keeps the result a permutation of its input", () => {
        const hits = ["f", "a", "c"].map((slug) => ({ slug }))
        const sorted = sortHitsByBaselineOrder(hits, baseline)
        expect(sorted).toHaveLength(hits.length)
        expect([...slugs(sorted)].sort()).toEqual([...slugs(hits)].sort())
    })

    it("does not mutate its input", () => {
        const hits = ["f", "a", "c"].map((slug) => ({ slug }))
        sortHitsByBaselineOrder(hits, baseline)
        expect(slugs(hits)).toEqual(["f", "a", "c"])
    })

    it("sorts hits missing from the baseline to the end, by identity", () => {
        const hits = ["zz", "c", "yy", "a"].map((slug) => ({ slug }))
        expect(slugs(sortHitsByBaselineOrder(hits, baseline))).toEqual([
            "a",
            "c",
            "yy",
            "zz",
        ])
    })

    it("orders unknown hits independently of the order they arrived in", () => {
        // The fallback position must not depend on Algolia's ranking, or two
        // keystrokes returning the same unknown records in different orders
        // would render them in different orders.
        const first = ["yy", "zz", "xx"].map((slug) => ({ slug }))
        const second = ["zz", "xx", "yy"].map((slug) => ({ slug }))
        expect(slugs(sortHitsByBaselineOrder(first, baseline))).toEqual(
            slugs(sortHitsByBaselineOrder(second, baseline))
        )
    })

    it("orders by identity alone when the baseline is empty", () => {
        const hits = ["c", "a", "b"].map((slug) => ({ slug }))
        expect(slugs(sortHitsByBaselineOrder(hits, []))).toEqual([
            "a",
            "b",
            "c",
        ])
    })

    it("handles an empty result set", () => {
        expect(sortHitsByBaselineOrder([], baseline)).toEqual([])
    })

    it("preserves the extra fields on each hit", () => {
        const hits = [
            { slug: "c", title: "Third" },
            { slug: "a", title: "First" },
        ]
        expect(sortHitsByBaselineOrder(hits, baseline)).toEqual([
            { slug: "a", title: "First" },
            { slug: "c", title: "Third" },
        ])
    })
})

describe(getVisibleChartHits, () => {
    // A topic's list, as the block holds it: the full result set for the
    // current query, in the block's default order.
    const hits = (count: number): { slug: string }[] =>
        Array.from({ length: count }, (_, index) => ({
            slug: `chart-${index}`,
        }))

    it("renders only the first slice of a long list", () => {
        // The CO2 topic's real size. Every one of those rows in the page is
        // what pinned the chart sidecar for seventeen viewport heights.
        const visible = getVisibleChartHits(hits(196), false)
        expect(visible).toHaveLength(ALL_CHARTS_INITIAL_ROW_COUNT)
    })

    it("renders the slice as a prefix of the list, in order", () => {
        // Load-bearing: the block resolves its selected row against the full
        // result set and hands the slice to the table, so the two only agree
        // about which row is selected while this is a prefix.
        const all = hits(196)
        expect(getVisibleChartHits(all, false, 4)).toEqual(all.slice(0, 4))
    })

    it("renders everything once the list is expanded", () => {
        const all = hits(196)
        expect(getVisibleChartHits(all, true)).toEqual(all)
    })

    it("renders every row of a list shorter than the slice, either way", () => {
        const all = hits(7)
        expect(getVisibleChartHits(all, false)).toEqual(all)
        expect(getVisibleChartHits(all, true)).toEqual(all)
    })

    it("handles an empty result set", () => {
        expect(getVisibleChartHits([], false)).toEqual([])
        expect(getVisibleChartHits([], true)).toEqual([])
    })

    it("does not mutate the list it slices", () => {
        const all = hits(30)
        getVisibleChartHits(all, false)
        expect(all).toHaveLength(30)
    })
})

describe(hasHiddenChartHits, () => {
    it("asks for the reveal control when rows are being held back", () => {
        expect(hasHiddenChartHits(196)).toBe(true)
        expect(hasHiddenChartHits(165)).toBe(true) // the "china" result set
        expect(hasHiddenChartHits(ALL_CHARTS_INITIAL_ROW_COUNT + 1)).toBe(true)
    })

    it("renders no control when the whole list is already on screen", () => {
        // Including at exactly the slice size: "Show all 25 indicators" under
        // a list of all 25 of them would do nothing.
        expect(hasHiddenChartHits(ALL_CHARTS_INITIAL_ROW_COUNT)).toBe(false)
        expect(hasHiddenChartHits(3)).toBe(false)
        expect(hasHiddenChartHits(0)).toBe(false)
    })

    it("agrees with what getVisibleChartHits actually renders", () => {
        // The control must appear exactly when the slice is hiding something,
        // whatever the two are given.
        for (const total of [0, 1, 24, 25, 26, 196]) {
            const all = Array.from({ length: total }, (_, index) => ({
                slug: `chart-${index}`,
            }))
            const isHiding = getVisibleChartHits(all, false).length < all.length
            expect(hasHiddenChartHits(total)).toBe(isHiding)
        }
    })
})

describe(capSuggestedSearches, () => {
    // The suggested-search line as each source hands it over: the OWID topic
    // vocabulary publishes eight terms for a topic, already ranked by what
    // each reveals of that topic's charts.
    const vocabularyTerms = [
        "co2 emissions",
        "greenhouse gas emissions",
        "carbon intensity",
        "methane",
        "emissions per capita",
        "cumulative emissions",
        "consumption-based emissions",
        "carbon price",
    ]

    it("offers five suggestions out of the vocabulary's eight", () => {
        expect(capSuggestedSearches(vocabularyTerms)).toHaveLength(
            ALL_CHARTS_MAX_SUGGESTED_SEARCHES
        )
    })

    it("keeps the source's own order, taking its first five", () => {
        // Load-bearing: the vocabulary ranks its terms by coverage, so its
        // first five are its best five — the cap must truncate rather than
        // choose. Same for a curated list, where the author chose the order.
        expect(capSuggestedSearches(vocabularyTerms)).toEqual(
            vocabularyTerms.slice(0, ALL_CHARTS_MAX_SUGGESTED_SEARCHES)
        )
    })

    it("caps a curated list from the gdoc block the same way", () => {
        // The block picks between its two sources and caps the result, so a
        // long editorial list is bounded exactly like a vocabulary one.
        const curated = ["a", "b", "c", "d", "e", "f", "g"]
        expect(capSuggestedSearches(curated)).toEqual(["a", "b", "c", "d", "e"])
    })

    it("leaves a list already at or under the cap alone", () => {
        const four = vocabularyTerms.slice(0, 4)
        expect(capSuggestedSearches(four)).toEqual(four)
        const five = vocabularyTerms.slice(0, 5)
        expect(capSuggestedSearches(five)).toEqual(five)
        expect(capSuggestedSearches([])).toEqual([])
    })

    it("does not mutate the list it caps", () => {
        const terms = [...vocabularyTerms]
        capSuggestedSearches(terms)
        expect(terms).toEqual(vocabularyTerms)
    })
})

describe(resolveSelectedChartIndex, () => {
    // The all-charts block's unfiltered rows, in their default order.
    const rows = ["a", "b", "c", "d", "e"].map((slug) => ({ slug }))

    it("selects the first row before anything has been picked", () => {
        expect(resolveSelectedChartIndex(rows, null)).toBe(0)
    })

    it("keeps the picked chart selected when the list narrows around it", () => {
        // Row 4 is picked, then a search removes two rows above it: the
        // selection follows the chart down to index 1 rather than staying on
        // index 3 (a different chart) or resetting to the top.
        const picked = getChartHitIdentity(rows[3])
        expect(resolveSelectedChartIndex(rows, picked)).toBe(3)

        const narrowed = ["b", "d", "e"].map((slug) => ({ slug }))
        expect(resolveSelectedChartIndex(narrowed, picked)).toBe(1)
    })

    it("keeps the picked chart selected when it moves to the top", () => {
        const picked = getChartHitIdentity(rows[4])
        expect(resolveSelectedChartIndex([{ slug: "e" }], picked)).toBe(0)
    })

    it("falls back to the first row when the picked chart is filtered out", () => {
        // The only case in which the selection is allowed to move on its own.
        const picked = getChartHitIdentity({ slug: "c" })
        const withoutC = ["a", "b", "d"].map((slug) => ({ slug }))
        expect(resolveSelectedChartIndex(withoutC, picked)).toBe(0)
    })

    it("survives the Featured Metric record swap on the first keystroke", () => {
        // Real objectIDs from the CO2 topic. The empty-query result set is
        // served FM records; the first character typed adds isFM:false and
        // swaps in the plain twins. The visible list is identical, so a
        // selection made before typing must still point at the same chart —
        // which an objectID-keyed selection could not do.
        const beforeTyping = [
            {
                objectID: "486-fm-upper-middle-co2-greenhouse-gas-emissions",
                slug: "co-emissions-per-capita",
            },
            {
                objectID: "488-fm-upper-middle-co2-greenhouse-gas-emissions",
                slug: "annual-co2-emissions-per-country",
            },
            {
                objectID: "4146-fm-upper-middle-co2-greenhouse-gas-emissions",
                slug: "ghg-emissions-by-sector",
            },
        ]
        const afterTyping = [
            { objectID: "486", slug: "co-emissions-per-capita" },
            { objectID: "488", slug: "annual-co2-emissions-per-country" },
            { objectID: "4146", slug: "ghg-emissions-by-sector" },
        ]

        const picked = getChartHitIdentity(beforeTyping[2])
        expect(resolveSelectedChartIndex(beforeTyping, picked)).toBe(2)
        expect(resolveSelectedChartIndex(afterTyping, picked)).toBe(2)
    })

    it("holds the selection across every keystroke of a country search", () => {
        // Typing "china" one character at a time, each prefix returning a
        // narrower set (and the plain records from the first character on).
        // ghg-emissions-by-sector, picked first, is in every one of them, so
        // the selection must never leave it.
        const picked = getChartHitIdentity({ slug: "ghg-emissions-by-sector" })
        const resultSets = [
            [
                "co-emissions-per-capita",
                "temperature-anomaly",
                "ghg-emissions-by-sector",
                "meat-supply-vs-gdp-per-capita",
            ], // ""
            [
                "co-emissions-per-capita",
                "temperature-anomaly",
                "ghg-emissions-by-sector",
                "meat-supply-vs-gdp-per-capita",
            ], // "c"
            [
                "co-emissions-per-capita",
                "ghg-emissions-by-sector",
                "meat-supply-vs-gdp-per-capita",
            ], // "ch"
            ["co-emissions-per-capita", "ghg-emissions-by-sector"], // "chi"
            ["ghg-emissions-by-sector"], // "chin"
            ["ghg-emissions-by-sector"], // "china"
        ]
        const selectedSlugs = resultSets.map((slugs) => {
            const hits = slugs.map((slug) => ({ slug }))
            return hits[resolveSelectedChartIndex(hits, picked)].slug
        })
        expect(selectedSlugs).toEqual(
            resultSets.map(() => "ghg-emissions-by-sector")
        )
    })

    it("distinguishes views that share a slug", () => {
        // Two explorer views of one slug are different charts to the block, so
        // picking one must not select the other.
        const views = [
            { slug: "energy", queryParams: "?country=~ESP" },
            { slug: "energy", queryParams: "?country=~FRA" },
        ]
        expect(
            resolveSelectedChartIndex(views, getChartHitIdentity(views[1]))
        ).toBe(1)
        // Only the FRA view survives: the selection lands on it at index 0
        // because it is the picked chart, not because it is the first row.
        expect(
            resolveSelectedChartIndex([views[1]], getChartHitIdentity(views[1]))
        ).toBe(0)
        // The ESP view alone, with FRA picked: the picked chart is gone, so
        // back to the first row.
        expect(
            resolveSelectedChartIndex([views[0]], getChartHitIdentity(views[1]))
        ).toBe(0)
    })

    it("returns the first index for an empty result set", () => {
        // The caller renders no sidecar at all in this case; this only has to
        // not throw.
        expect(resolveSelectedChartIndex([], null)).toBe(0)
        expect(resolveSelectedChartIndex([], "life-expectancy")).toBe(0)
    })
})

describe(filterChartHitsByQueryWords, () => {
    // The rows the Poverty topic returned for "national poverty line", with the
    // text each row actually shows. The first four are the charts the search is
    // asking for; the rest are what Algolia added because each word of the query
    // may be found in a different attribute of a record (a tag, a producer, the
    // slug), typos included.
    const nationalPovertyLine = {
        slug: "national-poverty-line-vs-gdp-per-capita",
        title: "National poverty line vs. GDP per capita",
        subtitle: "",
        datasetProducers: ["World Bank Poverty and Inequality Platform"],
    }
    const nationalPovertyLinesPlural = {
        slug: "share-of-population-living-in-poverty-by-national-poverty-lines",
        title: "Share of population living below national poverty lines",
        subtitle:
            "National poverty headcount ratio is the percentage of the population living below the national poverty lines.",
        datasetProducers: ["World Bank Poverty and Inequality Platform"],
    }
    // The chart the designer reported: none of "national", "poverty" or "line"
    // appears on the row. Algolia matched "poverty" in the producer name,
    // "line" elsewhere in the record, and "national" in "United Nations" via
    // typo tolerance.
    const meanIncome = {
        slug: "daily-mean-income",
        title: "Mean income or consumption per day",
        subtitle:
            "This data is adjusted for inflation and differences in living costs between countries.",
        datasetProducers: [
            "World Bank Poverty and Inequality Platform",
            "United Nations",
        ],
    }
    // Matched only through its subtitle's "International Poverty Line", which
    // contains the typed phrase as a raw substring but not as whole words.
    const extremePoverty = {
        slug: "share-of-population-in-extreme-poverty",
        title: "Share of population living in extreme poverty",
        subtitle:
            "Extreme poverty is defined as living below the International Poverty Line of $3 per day.",
        datasetProducers: ["World Bank Poverty and Inequality Platform"],
    }
    const povertyHits = [
        nationalPovertyLine,
        nationalPovertyLinesPlural,
        meanIncome,
        extremePoverty,
    ]

    it("keeps only the rows whose own text contains the whole phrase", () => {
        expect(
            filterChartHitsByQueryWords(povertyHits, "national poverty line")
        ).toEqual([nationalPovertyLine, nationalPovertyLinesPlural])
    })

    it("matches a plural in the row against a singular in the query", () => {
        // "national poverty lines" is the most relevant chart of all for this
        // search, and Algolia's own "exactPhrase" operator drops it.
        expect(
            filterChartHitsByQueryWords(
                [nationalPovertyLinesPlural],
                "national poverty line"
            )
        ).toEqual([nationalPovertyLinesPlural])
    })

    it("does not match a longer word mid-phrase", () => {
        // "International Poverty Line" contains "national poverty line" as a
        // substring, but "international" is not the word that was typed.
        expect(
            filterChartHitsByQueryWords(
                [extremePoverty],
                "national poverty line"
            )
        ).toEqual([])
        // Whereas the phrase the row does show is found.
        expect(
            filterChartHitsByQueryWords(
                [extremePoverty],
                "international poverty line"
            )
        ).toEqual([extremePoverty])
    })

    it("never gathers a query's words from more than one of a row's fields", () => {
        // Every word of the query appears on this row — across the title, the
        // subtitle and the producer list — but no single one of them holds them
        // all. That boundary, not word adjacency, is what keeps the noise out.
        expect(
            filterChartHitsByQueryWords(
                [meanIncome],
                "united nations poverty platform"
            )
        ).toEqual([])
    })

    it("matches the words in any order, and with words in between", () => {
        // Requiring adjacency rejected rows that plainly answer the query: this
        // is the shape that made "clean cooking" find nothing on Air Pollution,
        // whose charts all read "access to clean fuels *for* cooking".
        const methane = {
            slug: "per-capita-methane-emissions",
            title: "Per capita methane emissions",
            subtitle: "Measured in tonnes.",
            datasetProducers: ["Climate Watch"],
        }
        expect(
            filterChartHitsByQueryWords([methane], "emissions per capita")
        ).toEqual([methane])
        expect(
            filterChartHitsByQueryWords([methane], "methane capita")
        ).toEqual([methane])
        // …but the words still have to share a field: "emissions" is only in the
        // title and "tonnes" only in the subtitle.
        expect(
            filterChartHitsByQueryWords([methane], "emissions tonnes")
        ).toEqual([])
    })

    it("finds subscript digits typed as plain ones", () => {
        // Chart titles use "CO₂", visitors type "co2".
        const co2 = {
            slug: "co2-emissions-per-capita",
            title: "CO₂ emissions per capita",
            subtitle: "Carbon dioxide (CO₂) emissions from fossil fuels.",
            datasetProducers: ["Global Carbon Project"],
        }
        expect(filterChartHitsByQueryWords([co2], "co2 emissions")).toEqual([
            co2,
        ])
        expect(
            filterChartHitsByQueryWords([co2], "co₂ emissions per capita")
        ).toEqual([co2])
    })

    it("matches the source line as well as the title and subtitle", () => {
        expect(filterChartHitsByQueryWords(povertyHits, "world bank")).toEqual(
            povertyHits
        )
    })

    it("treats a half-typed last word as a prefix", () => {
        // The query is debounced, not submitted, so the last word is routinely
        // unfinished — the list must not empty out mid-word.
        for (const prefix of [
            "national",
            "national pov",
            "national poverty l",
            "national poverty line",
        ])
            expect(filterChartHitsByQueryWords(povertyHits, prefix)).toEqual([
                nationalPovertyLine,
                nationalPovertyLinesPlural,
            ])
    })

    it("keeps every hit when there is no phrase to match", () => {
        // The all-charts block passes an empty phrase whenever the query is
        // empty, or consists only of a country name — which filters by the
        // entity facet instead, and must not additionally require the country's
        // name to be printed on the row.
        expect(filterChartHitsByQueryWords(povertyHits, "")).toEqual(
            povertyHits
        )
        expect(filterChartHitsByQueryWords(povertyHits, "   ")).toEqual(
            povertyHits
        )
        // Punctuation-only input normalises to no words at all.
        expect(filterChartHitsByQueryWords(povertyHits, "-")).toEqual(
            povertyHits
        )
    })

    it("drops every hit for a misspelled phrase", () => {
        // Typo tolerance does not survive this narrowing: Algolia still returns
        // the typo-matched hits, but none of them shows the typed phrase, so the
        // block falls through to its empty state ("Search all charts").
        expect(
            filterChartHitsByQueryWords(povertyHits, "national povery line")
        ).toEqual([])
    })
})

describe(textContainsAllQueryWords, () => {
    it("ignores case, punctuation and repeated whitespace", () => {
        expect(
            textContainsAllQueryWords(
                "Share of population living\nin poverty",
                "IN POVERTY"
            )
        ).toBe(true)
        expect(
            textContainsAllQueryWords(
                "Poverty: share of population",
                "poverty share"
            )
        ).toBe(true)
    })

    it("matches at the start and at the end of the text", () => {
        expect(
            textContainsAllQueryWords("Annual CO₂ emissions", "annual")
        ).toBe(true)
        expect(
            textContainsAllQueryWords("Annual CO₂ emissions", "co2 emissions")
        ).toBe(true)
    })

    it("returns false when the text runs out mid-phrase", () => {
        expect(
            textContainsAllQueryWords(
                "Annual CO₂ emissions",
                "emissions by sector"
            )
        ).toBe(false)
    })
})

describe(splitTextByQueryWordMatches, () => {
    // What a caller renders in bold; the plain runs between them are the rest
    // of the text.
    const matched = (text: string, query: string) =>
        splitTextByQueryWordMatches(text, query)
            .filter((segment) => segment.isMatch)
            .map((segment) => segment.text)

    // The segments always reassemble into the text they came from — nothing is
    // dropped, duplicated or re-cased on the way through.
    const assertLosslessFor = (text: string, query: string) =>
        expect(
            splitTextByQueryWordMatches(text, query)
                .map((segment) => segment.text)
                .join("")
        ).toEqual(text)

    it("marks a multi-word query as one run, gaps included", () => {
        expect(
            matched(
                "Per capita CO₂ emissions from cement",
                "per capita co2 emissions"
            )
        ).toEqual(["Per capita CO₂ emissions"])
        assertLosslessFor(
            "Per capita CO₂ emissions from cement",
            "per capita co2 emissions"
        )
    })

    it("marks the words wherever they are, in any order", () => {
        // The row filter no longer requires the typed words to be adjacent, so
        // neither does this: bolding only an adjacent run would leave a row
        // that matched looking as though it hadn't.
        expect(
            matched("Per capita methane emissions", "emissions per capita")
        ).toEqual(["Per capita", "emissions"])
    })

    it("folds a subscript the way the filter does", () => {
        expect(matched("Annual CO₂ emissions", "co2")).toEqual(["CO₂"])
        expect(matched("Annual CO2 emissions", "co₂")).toEqual(["CO2"])
    })

    it("marks a prefix match on the last word only", () => {
        // Mid-typing: "emissions per cap" bolds the half-typed word too,
        // because that is the word the filter matched on.
        expect(
            matched("Per capita CO₂ emissions", "emissions per cap")
        ).toEqual(["Per capita", "emissions"])
        // Only the last word gets the prefix rule: a half-typed leading word
        // matches nothing, and nothing is bolded for it. (A row like this is
        // filtered out anyway — the filter needs every leading word — so this
        // is about the rule being the same on both sides, not about the row.)
        expect(matched("Per capita CO₂ emissions", "capit emissions")).toEqual([
            "emissions",
        ])
    })

    it("marks nothing when the text does not contain the query", () => {
        expect(
            splitTextByQueryWordMatches("Annual CO₂ emissions", "poverty")
        ).toEqual([{ text: "Annual CO₂ emissions", isMatch: false }])
    })

    it("marks nothing for an empty query", () => {
        // What the block passes for a country-only search: "china" is applied
        // as an entity facet and taken out of the phrase, so the country name
        // printed on the row is not bolded. Same for the untyped default view.
        expect(
            splitTextByQueryWordMatches("CO₂ emissions in China", "")
        ).toEqual([{ text: "CO₂ emissions in China", isMatch: false }])
        // ...and with a word left over beside the country, only that word is
        // bolded.
        expect(matched("CO₂ emissions in China", "emissions")).toEqual([
            "emissions",
        ])
    })
})

describe(getDuplicatedChartTitles, () => {
    it("collects only the titles more than one chart carries", () => {
        const duplicated = getDuplicatedChartTitles([
            { title: "Greenhouse gas emissions by sector" },
            { title: "Greenhouse gas emissions by sector" },
            { title: "Annual CO₂ emissions" },
        ])
        expect([...duplicated]).toEqual(["greenhouse gas emissions by sector"])
    })

    it("counts titles that differ only in punctuation as the same", () => {
        // Two rows a reader can't tell apart are a collision whatever the
        // records say — "CO₂" and "CO2" render as different characters but the
        // titles read identically.
        const duplicated = getDuplicatedChartTitles([
            { title: "Annual CO₂ emissions" },
            { title: "Annual CO2 emissions!" },
        ])
        expect(duplicated.size).toEqual(1)
    })
})

describe(getChartHitVariantName, () => {
    const duplicated = getDuplicatedChartTitles([
        { title: "Greenhouse gas emissions by sector" },
        { title: "Greenhouse gas emissions by sector" },
    ])

    it("shows the variant name on a title two charts share", () => {
        expect(
            getChartHitVariantName(
                {
                    title: "Greenhouse gas emissions by sector",
                    variantName: "Stacked areas",
                },
                duplicated
            )
        ).toEqual("Stacked areas")
    })

    it("shows nothing on a title only one chart carries", () => {
        expect(
            getChartHitVariantName(
                { title: "Annual CO₂ emissions", variantName: "Lines" },
                duplicated
            )
        ).toBeUndefined()
    })

    it("shows nothing when there is no variant name to show", () => {
        expect(
            getChartHitVariantName(
                {
                    title: "Greenhouse gas emissions by sector",
                    variantName: "",
                },
                duplicated
            )
        ).toBeUndefined()
    })

    it("shows nothing when the variant name just repeats the title", () => {
        // Explorer-view records carry the view's own title as their variant
        // name, which would render as the title twice over.
        expect(
            getChartHitVariantName(
                {
                    title: "Greenhouse gas emissions by sector",
                    variantName: "Greenhouse gas emissions by sector",
                },
                duplicated
            )
        ).toBeUndefined()
    })
})
