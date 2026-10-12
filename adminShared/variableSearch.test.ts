import { describe, expect, it } from "vitest"
import { parseSearchTerm, splitSearchTerms } from "./variableSearch.js"

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

describe(parseSearchTerm, () => {
    it("separates an exclusion, a lowercased field and its value", () => {
        expect(parseSearchTerm("-Dataset-ID:12")).toEqual({
            raw: "-Dataset-ID:12",
            negate: true,
            field: "dataset-id",
            value: "12",
        })
    })

    it("keeps everything after the first colon as the value", () => {
        expect(parseSearchTerm("name:foo:bar").value).toBe("foo:bar")
        expect(parseSearchTerm("name:foo\nbar").value).toBe("foo\nbar")
    })

    it("reads a word without a field as the value", () => {
        expect(parseSearchTerm("road")).toEqual({
            raw: "road",
            negate: false,
            value: "road",
        })
        expect(parseSearchTerm(".*:x")).toEqual({
            raw: ".*:x",
            negate: false,
            value: ".*:x",
        })
    })
})
