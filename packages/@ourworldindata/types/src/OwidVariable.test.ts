import { expect, it, describe } from "vitest"

import { normalizeDescriptionKey } from "./OwidVariable.js"

describe(normalizeDescriptionKey, () => {
    it("passes strings through", () => {
        expect(normalizeDescriptionKey("Some *markdown* text.")).toEqual(
            "Some *markdown* text."
        )
    })

    it("returns undefined for empty values", () => {
        expect(normalizeDescriptionKey(undefined)).toBeUndefined()
        expect(normalizeDescriptionKey(null)).toBeUndefined()
        expect(normalizeDescriptionKey("")).toBeUndefined()
        expect(normalizeDescriptionKey("  ")).toBeUndefined()
        expect(normalizeDescriptionKey([])).toBeUndefined()
        expect(normalizeDescriptionKey(["", "  "])).toBeUndefined()
    })

    it("converts a single-entry array to prose", () => {
        expect(normalizeDescriptionKey(["A single point."])).toEqual(
            "A single point."
        )
    })

    it("converts a multi-entry array to a markdown list", () => {
        expect(normalizeDescriptionKey(["Point one.", "Point two."])).toEqual(
            "- Point one.\n- Point two."
        )
    })

    it("indents continuation lines of multi-line entries", () => {
        expect(
            normalizeDescriptionKey(["First line\nsecond line", "Other."])
        ).toEqual("- First line\n  second line\n- Other.")
    })
})
