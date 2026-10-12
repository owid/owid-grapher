import { describe, expect, it } from "vitest"
import { splitSearchTerms } from "./variableSearch.js"

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
