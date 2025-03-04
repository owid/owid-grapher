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
