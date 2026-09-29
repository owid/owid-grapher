import { describe, expect, it } from "vitest"

import {
    fieldedTerms,
    searchWordsToHighlight,
    SearchFieldHelp,
    withoutTerms,
} from "./variableSearchQuery.js"

const FIELDS: SearchFieldHelp[] = [
    { name: "namespace", type: "string", description: "" },
    { name: "before", type: "date", description: "" },
]

describe(fieldedTerms, () => {
    it("finds field:value terms, exclusions included", () => {
        expect(fieldedTerms("namespace:climate civil -dataset:x")).toEqual([
            "namespace:climate",
            "-dataset:x",
        ])
    })

    it("ignores a field that is still being typed", () => {
        expect(fieldedTerms("namespace:")).toEqual([])
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
        searchWordsToHighlight(query, FIELDS).map((word) => word.word)

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
