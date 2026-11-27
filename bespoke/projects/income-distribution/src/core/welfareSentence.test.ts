import { describe, expect, it } from "vitest"

import type { WelfareType } from "./types.js"
import { noteText } from "./dods.js"
import { welfareTypeSentence } from "./welfareSentence.js"

const WELFARE_TYPE_BY_COUNTRY: Record<string, WelfareType> = {
    China: "consumption",
    Germany: "income",
    India: "consumption",
    Nigeria: "consumption",
    "United States": "income",
}
const welfareTypeOf = (name: string): WelfareType =>
    WELFARE_TYPE_BY_COUNTRY[name]

/** The sentence for `countries` as plain text */
function sentence(countries: string[]): string | undefined {
    const segments = welfareTypeSentence(countries, welfareTypeOf)
    return segments && noteText(segments)
}

describe(welfareTypeSentence, () => {
    it("says nothing without countries", () => {
        expect(welfareTypeSentence([], welfareTypeOf)).toBeUndefined()
    })

    it("names the type of a single country", () => {
        expect(sentence(["Germany"])).toBe(
            "Germany reports income after taxes and benefits."
        )
        expect(sentence(["United States"])).toBe(
            "The United States reports income after taxes and benefits."
        )
        expect(sentence(["China"])).toBe("China reports consumption.")
    })

    it("lists income countries, then consumption countries, in their given order", () => {
        expect(
            sentence(["China", "Germany", "India", "United States", "Nigeria"])
        ).toBe(
            "Germany and the United States report income after taxes and benefits; China, India, and Nigeria report consumption."
        )
        expect(sentence(["United States", "China"])).toBe(
            "The United States reports income after taxes and benefits; China reports consumption."
        )
    })

    it("sums up countries that all share a type", () => {
        expect(sentence(["China", "India", "Nigeria"])).toBe(
            "All of these countries report consumption."
        )
        expect(sentence(["Germany", "United States"])).toBe(
            "Both of these countries report income after taxes and benefits."
        )
    })

    // The UI turns these into details-on-demand spans
    it("marks each welfare type's term as its own segment", () => {
        expect(
            welfareTypeSentence(["Germany", "China"], welfareTypeOf)
        ).toEqual([
            "Germany reports ",
            { dod: "income" },
            "; China reports ",
            { dod: "consumption" },
            ".",
        ])
    })
})
