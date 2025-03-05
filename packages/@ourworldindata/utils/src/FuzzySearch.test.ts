import { expect, it, describe } from "vitest"

import { FuzzySearch } from "./FuzzySearch.js"

describe(FuzzySearch, () => {
    const countries = [
        { name: "United States", population: 329.5 },
        { name: "United Kingdom", population: 67.2 },
        { name: "Germany", population: 83.2 },
        { name: "France", population: 67.4 },
        { name: "Spain", population: 47.4 },
        { name: "Italy", population: 60.3 },
    ]

    describe("withKey", () => {
        it("creates a fuzzy search instance with a key function", () => {
            const search = FuzzySearch.withKey(
                countries,
                (country) => country.name
            )
            expect(search).toBeInstanceOf(FuzzySearch)
        })

        it("finds results based on fuzzy matching", () => {
            const search = FuzzySearch.withKey(
                countries,
                (country) => country.name
            )
            const results = search.search("united")
            expect(results).toHaveLength(2)
            expect(results.map((c) => c.name).sort()).toEqual([
                "United Kingdom",
                "United States",
            ])
        })

        it("returns empty array for no matches", () => {
            const search = FuzzySearch.withKey(
                countries,
                (country) => country.name
            )
            const results = search.search("australia")
            expect(results).toHaveLength(0)
        })

        it("handles empty search input", () => {
            const search = FuzzySearch.withKey(
                countries,
                (country) => country.name
            )
            const results = search.search("")
            expect(results).toHaveLength(0)
        })

        it("can handle a single key pointing to multiple values", () => {
            const data = [
                { name: "GDP", chart: "gdp-world-bank" },
                { name: "GDP", chart: "gdp-maddison" },
            ]
            const search = FuzzySearch.withKey(data, (d) => d.name)
            const results = search.search("GDP")
            expect(results).toHaveLength(2)
            expect(results.map((d) => d.chart).sort()).toEqual([
                "gdp-maddison",
                "gdp-world-bank",
            ])
        })
    })

    const countriesWithAliases = [
        {
            name: "Netherlands",
            aliases: ["Netherlands", "Nederland", "Holland"],
        },
        { name: "Spain", aliases: ["Spain", "España"] },
        { name: "Germany", aliases: ["Germany", "Deutschland"] },
    ]

    describe("withKeyArray", () => {
        it("creates a fuzzy search instance with multiple keys per object", () => {
            const search = FuzzySearch.withKeyArray(
                countriesWithAliases,
                (country) => country.aliases
            )
            expect(search).toBeInstanceOf(FuzzySearch)
        })

        it("finds results based on any of the keys", () => {
            const search = FuzzySearch.withKeyArray(
                countriesWithAliases,
                (country) => country.aliases
            )

            const hollandResults = search.search("holland")
            expect(hollandResults).toHaveLength(1)
            expect(hollandResults[0].name).toBe("Netherlands")

            const espanaResults = search.search("españa")
            expect(espanaResults).toHaveLength(1)
            expect(espanaResults[0].name).toBe("Spain")
        })

        it("may return duplicate objects if multiple keys match", () => {
            const duplicateKeyData = [
                { id: 1, keys: ["apple", "fruit", "red"] },
                { id: 2, keys: ["banana", "fruit", "yellow"] },
            ]

            const search = FuzzySearch.withKeyArray(
                duplicateKeyData,
                (item) => item.keys
            )
            const results = search.search("fruit")
            expect(results).toHaveLength(2)
        })

        it("can make use of a 'unique by' function", () => {
            const search = FuzzySearch.withKeyArray(
                countriesWithAliases,
                (item) => item.aliases,
                (item) => item.name
            )
            const results = search.search("land")
            expect(results).toHaveLength(2)
        })

        it("handles case sensitivity in searches", () => {
            const search = FuzzySearch.withKeyArray(
                countriesWithAliases,
                (item) => item.aliases
            )
            const results = search.search("NETHERLANDS")
            expect(results).toHaveLength(1)
            expect(results[0].name).toBe("Netherlands")
        })

        it("handles accented characters in searches", () => {
            const search = FuzzySearch.withKeyArray(
                countriesWithAliases,
                (item) => item.aliases
            )
            const results = search.search("espana")
            expect(results).toHaveLength(1)
            expect(results[0].name).toBe("Spain")
        })
    })

    describe("searchResults", () => {
        it("returns raw fuzzysort results", () => {
            const search = FuzzySearch.withKey(
                countries,
                (country) => country.name
            )
            const results = search.searchResults("united")

            expect(results).toBeInstanceOf(Array)
            expect(results.length).toBe(2)
            expect(results[0]).toHaveProperty("target")
            expect(results[0]).toHaveProperty("score")
        })
    })

    describe("single", () => {
        it("performs fuzzy match against a single target", () => {
            const search = FuzzySearch.withKey(
                countries,
                (country) => country.name
            )
            const result = search.single("germny", "Germany")

            expect(result).not.toBeNull()
            expect(result?.target).toBe("Germany")
        })

        it("returns null for no match", () => {
            const search = FuzzySearch.withKey(
                countries,
                (country) => country.name
            )
            const result = search.single("xyz", "Germany")

            expect(result).toBeNull()
        })
    })
})
