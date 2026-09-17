import { expect, it, describe } from "vitest"

import { canUseFulltext, unindexedSearchTerms } from "./Variable.js"

describe(canUseFulltext, () => {
    it("takes ordinary words", () => {
        expect(canUseFulltext("deaths")).toBe(true)
        expect(canUseFulltext("co2")).toBe(true)
        expect(canUseFulltext("uk_road_deaths_ons")).toBe(true)
    })

    it("rejects terms below the index's minimum token length", () => {
        expect(canUseFulltext("uk")).toBe(false)
        expect(canUseFulltext("a")).toBe(false)
    })

    it("rejects MySQL's stopwords, which the index leaves out", () => {
        // `who` is one of our namespaces, so this one matters
        expect(canUseFulltext("who")).toBe(false)
        expect(canUseFulltext("WHO")).toBe(false)
        expect(canUseFulltext("when")).toBe(false)
        expect(canUseFulltext("where")).toBe(false)
    })

    it("rejects terms carrying regex syntax, which the search box advertises", () => {
        expect(canUseFulltext("^population")).toBe(false)
        expect(canUseFulltext("deaths$")).toBe(false)
        expect(canUseFulltext("co(2|₂)")).toBe(false)
        expect(canUseFulltext("gdp.*capita")).toBe(false)
    })

    it("is decided per term, so a term means the same whatever surrounds it", () => {
        // adding a word never changes how the words already typed are matched
        for (const term of ["road", "deaths", "uk", "^pop"]) {
            expect(canUseFulltext(term)).toBe(canUseFulltext(term))
        }
        expect(canUseFulltext("road")).toBe(true)
        expect(canUseFulltext("uk")).toBe(false)
    })
})

describe(unindexedSearchTerms, () => {
    it("names the terms that fall back to a substring scan", () => {
        expect(unindexedSearchTerms("uk road deaths")).toEqual(["uk"])
        expect(unindexedSearchTerms("who deaths")).toEqual(["who"])
        expect(unindexedSearchTerms("^population before:2023")).toEqual([
            "^population",
        ])
    })

    it("is empty when every term can use the index", () => {
        expect(unindexedSearchTerms("road deaths")).toEqual([])
        expect(unindexedSearchTerms("")).toEqual([])
        expect(unindexedSearchTerms(undefined)).toEqual([])
    })

    it("ignores fielded terms and exclusions, which were never indexed", () => {
        expect(unindexedSearchTerms("namespace:who dataset:gho")).toEqual([])
        expect(unindexedSearchTerms("deaths -uk")).toEqual([])
        expect(unindexedSearchTerms("is:private")).toEqual([])
    })
})
