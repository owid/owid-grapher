import { describe, expect, it } from "vitest"

import {
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
