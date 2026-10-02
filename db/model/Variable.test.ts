import { expect, it, describe } from "vitest"
import knex from "knex"

import {
    canUseFulltext,
    escapeKnexPlaceholders,
    splitSearchTerms,
    unindexedSearchTerms,
} from "./Variable.js"

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

    it("splits a term the way MySQL's tokenizer would", () => {
        // handed whole, `+age-standardized*` reads as "age but NOT
        // standardized" and matched none of the 5,751 rows it should
        expect(canUseFulltext("age-standardized")).toBe(true)
        expect(canUseFulltext("grapher/who")).toBe(true)
        expect(canUseFulltext("covid-19")).toBe(true)
    })

    it("has no usable token when every word is one the index drops", () => {
        expect(canUseFulltext("who-is")).toBe(false)
        expect(canUseFulltext("a-b")).toBe(false)
        expect(canUseFulltext("19")).toBe(false)
    })

    it("rejects terms carrying regex syntax, which the search box advertises", () => {
        expect(canUseFulltext("^population")).toBe(false)
        expect(canUseFulltext("deaths$")).toBe(false)
        expect(canUseFulltext("co(2|₂)")).toBe(false)
        expect(canUseFulltext("gdp.*capita")).toBe(false)
        // alternation makes the words alternatives, so neither is required
        expect(canUseFulltext("deaths|births")).toBe(false)
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

    it("checks the value of a path field, which goes through the index too", () => {
        expect(unindexedSearchTerms("namespace:who dataset:gho")).toEqual([
            "namespace:who",
        ])
        expect(unindexedSearchTerms("name:uk")).toEqual(["name:uk"])
    })

    it("ignores exclusions and fields matched on the dataset", () => {
        expect(unindexedSearchTerms("deaths -uk")).toEqual([])
        expect(unindexedSearchTerms("is:private datasetid:12")).toEqual([])
    })
})

describe(splitSearchTerms, () => {
    it("keeps a quoted phrase together and drops the quotes", () => {
        expect(splitSearchTerms('"life expectancy" -uk')).toEqual([
            "life expectancy",
            "-uk",
        ])
        expect(splitSearchTerms('name:"road deaths" who')).toEqual([
            "name:road deaths",
            "who",
        ])
    })

    it("splits on any run of whitespace", () => {
        expect(splitSearchTerms("  road   deaths ")).toEqual(["road", "deaths"])
    })
})

describe(escapeKnexPlaceholders, () => {
    const mysql = knex({ client: "mysql2" })

    it("hands knex back exactly the SQL it was given", () => {
        // what `escape` produces for a term with `?` and backslashes in it:
        // `why?`, `a\?` (a literal question mark in a regex), `\\?`, `??`
        for (const sql of [
            "SELECT 'why?'",
            "SELECT 'a\\\\?'",
            "SELECT 'x\\\\\\\\?'",
            "SELECT '??' AS `a?`",
            "SELECT 'no placeholders'",
        ]) {
            expect(mysql.raw(escapeKnexPlaceholders(sql)).toString()).toBe(sql)
        }
    })
})
