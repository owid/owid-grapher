import { describe, expect, it } from "vitest"

import { WELFARE_TYPES } from "./types.js"
import { placeholderWelfareType } from "./welfareType.js"

/** Real country names, as the feed spells them */
const COUNTRY_NAMES = [
    "Bangladesh",
    "Brazil",
    "China",
    "Colombia",
    "Democratic Republic of Congo",
    "Egypt",
    "Ethiopia",
    "France",
    "Germany",
    "India",
    "Indonesia",
    "Mexico",
    "Nigeria",
    "Pakistan",
    "Philippines",
    "Russia",
    "South Africa",
    "United Kingdom",
    "United States",
    "Vietnam",
]

describe(placeholderWelfareType, () => {
    it("gives a country the same value every time", () => {
        const first = COUNTRY_NAMES.map(placeholderWelfareType)
        const second = COUNTRY_NAMES.map(placeholderWelfareType)
        expect(second).toEqual(first)
    })

    // Pinned, so a change to the hash (which would reshuffle the badges
    // readers have seen) is deliberate
    it("doesn't change between sessions", () => {
        expect(
            ["China", "United States", "India", "Germany"].map(
                placeholderWelfareType
            )
        ).toEqual(["consumption", "income", "consumption", "income"])
    })

    it("gives some countries income and others consumption", () => {
        const values = new Set(COUNTRY_NAMES.map(placeholderWelfareType))
        expect([...values].toSorted()).toEqual([...WELFARE_TYPES].toSorted())
    })
})
