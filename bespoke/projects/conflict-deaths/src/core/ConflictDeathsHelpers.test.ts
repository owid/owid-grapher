import { describe, expect, it } from "vitest"

import { formatShare, regionArticle } from "./ConflictDeathsHelpers.js"

describe(formatShare, () => {
    it("rounds to two significant figures", () => {
        expect(formatShare(0.3712)).toBe("37%")
        expect(formatShare(0.0094)).toBe("0.94%")
    })

    // A region holding 99.8% of deaths shouldn't read as if it held all of them
    it("never rounds a partial share up to 100%", () => {
        expect(formatShare(0.998)).toBe(">99%")
        expect(formatShare(1)).toBe("100%")
    })
})

describe(regionArticle, () => {
    it("adds 'the' where a region name needs it mid-sentence", () => {
        expect(regionArticle("Americas")).toBe("the ")
        expect(regionArticle("Middle East")).toBe("the ")
        expect(regionArticle("Africa")).toBe("")
    })
})
