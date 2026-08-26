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

    it("flattens line and paragraph breaks inside entries", () => {
        // The old renderer unwrapped paragraphs inside list items, so breaks
        // displayed as plain spaces — the conversion replicates that.
        expect(
            normalizeDescriptionKey(["First line\nsecond line", "Other."])
        ).toEqual("- First line second line\n- Other.")
        expect(
            normalizeDescriptionKey(["Para one.\n\nPara two.", "Other."])
        ).toEqual("- Para one. Para two.\n- Other.")
    })

    it("keeps markdown lists inside entries as nested lists", () => {
        expect(
            normalizeDescriptionKey(["Includes:\n- a\n- b", "Other."])
        ).toEqual("- Includes:\n  - a\n  - b\n- Other.")
    })

    it("passes a single multi-line entry through unchanged", () => {
        // A single entry was rendered as full markdown, paragraphs included.
        expect(normalizeDescriptionKey(["Para one.\n\nPara two."])).toEqual(
            "Para one.\n\nPara two."
        )
    })
})
