import { describe, expect, it } from "vitest"

import type { WelfareType } from "./types.js"
import { formatCountryList, welfareTypeSentence } from "./welfareSentence.js"

const WELFARE_TYPE_BY_COUNTRY: Record<string, WelfareType> = {
    China: "consumption",
    Germany: "income",
    India: "consumption",
    Nigeria: "consumption",
    "United States": "income",
}
const welfareTypeOf = (name: string): WelfareType =>
    WELFARE_TYPE_BY_COUNTRY[name]

describe(formatCountryList, () => {
    it("joins names with commas and a final 'and'", () => {
        expect(formatCountryList(["Germany"])).toBe("Germany")
        expect(formatCountryList(["Germany", "China"])).toBe(
            "Germany and China"
        )
        expect(formatCountryList(["Germany", "China", "India"])).toBe(
            "Germany, China and India"
        )
    })

    it("names countries as they read mid-sentence", () => {
        expect(formatCountryList(["India", "United States"])).toBe(
            "India and the United States"
        )
    })
})

describe(welfareTypeSentence, () => {
    it("says nothing without countries", () => {
        expect(welfareTypeSentence([], welfareTypeOf)).toBeUndefined()
    })

    it("names the type of a single country", () => {
        expect(welfareTypeSentence(["Germany"], welfareTypeOf)).toBe(
            "Germany reports income."
        )
        expect(welfareTypeSentence(["United States"], welfareTypeOf)).toBe(
            "The United States reports income."
        )
    })

    it("lists income countries, then consumption countries, in their given order", () => {
        expect(
            welfareTypeSentence(
                ["China", "Germany", "India", "United States", "Nigeria"],
                welfareTypeOf
            )
        ).toBe(
            "Germany and the United States report income; China, India and Nigeria report consumption."
        )
        expect(
            welfareTypeSentence(["United States", "China"], welfareTypeOf)
        ).toBe("The United States reports income; China reports consumption.")
    })

    it("sums up countries that all share a type", () => {
        expect(
            welfareTypeSentence(["China", "India", "Nigeria"], welfareTypeOf)
        ).toBe("All of these countries report consumption.")
        expect(
            welfareTypeSentence(["Germany", "United States"], welfareTypeOf)
        ).toBe("Both of these countries report income.")
    })
})
