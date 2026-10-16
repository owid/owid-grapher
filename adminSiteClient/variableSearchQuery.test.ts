import { describe, expect, it } from "vitest"

import {
    catalogTableOf,
    countIndicatorsByTable,
    fieldedTerms,
    namesOneDataset,
    searchWordsToHighlight,
    withoutTerms,
} from "./variableSearchQuery.js"

describe(fieldedTerms, () => {
    it("finds field:value terms, exclusions included", () => {
        expect(fieldedTerms("namespace:climate civil -dataset:x")).toEqual([
            "namespace:climate",
            "-dataset:x",
        ])
    })

    it("ignores a field that is still being typed, or that isn't one", () => {
        expect(fieldedTerms("namespace:")).toEqual([])
        expect(fieldedTerms("https://example.org")).toEqual([])
    })
})

describe(namesOneDataset, () => {
    it("is true for a dataset filter with a value", () => {
        expect(namesOneDataset("road dataset-id:12")).toBe(true)
        expect(namesOneDataset("Dataset:gho")).toBe(true)
    })

    it("is false for an exclusion or a field still being typed", () => {
        expect(namesOneDataset("-dataset:wdi")).toBe(false)
        expect(namesOneDataset("road dataset-id:")).toBe(false)
    })

    it("is false for a dataset id the server can't read as a number", () => {
        expect(namesOneDataset("dataset-id:abc")).toBe(false)
    })
})

describe(withoutTerms, () => {
    it("drops exactly the given terms", () => {
        expect(
            withoutTerms("namespace:climate civil", ["namespace:climate"])
        ).toEqual("civil")
    })
})

describe(searchWordsToHighlight, () => {
    const words = (query: string): string[] =>
        searchWordsToHighlight(query).map((word) => word.word)

    it("highlights plain words and the values of string fields", () => {
        expect(words("road namespace:who")).toEqual(["road", "who"])
    })

    it("skips exclusions and non-string fields", () => {
        expect(words("deaths -uk before:2023")).toEqual(["deaths"])
    })

    it("highlights an unknown field as typed, since the server searches it as text", () => {
        expect(words("a:b")).toEqual(["a:b"])
    })
})

describe(catalogTableOf, () => {
    it("is the table segment of a grapher catalog path", () => {
        expect(
            catalogTableOf(
                "grapher/oecd/2026-10-07/climate_related_official_development_assistance/climate_related_oda_by_donor#oda_bilateral_total"
            )
        ).toEqual("climate_related_oda_by_donor")
    })

    it("is undefined without a catalog path, or without a table in it", () => {
        expect(catalogTableOf(null)).toBeUndefined()
        expect(catalogTableOf("grapher/who/2026-05-22/gho")).toBeUndefined()
    })
})

describe(countIndicatorsByTable, () => {
    it("counts the indicators of each table, tables by name", () => {
        expect(
            countIndicatorsByTable([
                { catalogPath: "grapher/oecd/2026-10-07/oda/by_recipient#a" },
                { catalogPath: "grapher/oecd/2026-10-07/oda/by_donor#b" },
                { catalogPath: "grapher/oecd/2026-10-07/oda/by_donor#c" },
            ])
        ).toEqual([
            { table: "by_donor", count: 2 },
            { table: "by_recipient", count: 1 },
        ])
    })

    it("leaves out indicators without a catalog path", () => {
        expect(
            countIndicatorsByTable([
                { catalogPath: null },
                {},
                { catalogPath: "grapher/oecd/2026-10-07/oda/by_donor#b" },
            ])
        ).toEqual([{ table: "by_donor", count: 1 }])
    })
})
