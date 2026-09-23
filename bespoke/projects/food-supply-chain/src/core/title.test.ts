import { describe, expect, it } from "vitest"

import { buildSubtitle, buildTitle } from "./title.js"

describe(buildTitle, () => {
    it("asks about calories as a plural", () => {
        expect(buildTitle("Germany", "energy")).toBe(
            "How many calories does Germany produce, and where do they go?"
        )
    })

    it("asks about protein as a mass noun", () => {
        expect(buildTitle("Germany", "protein")).toBe(
            "How much protein does Germany produce, and where does it go?"
        )
    })

    it("articulates an entity that takes an article", () => {
        expect(buildTitle("United States", "energy")).toBe(
            "How many calories does the United States produce, and where do they go?"
        )
    })
})

describe(buildSubtitle, () => {
    it("names the measured quantity and the year", () => {
        expect(buildSubtitle("energy", 2023)).toBe(
            "Measured as the average number of kilocalories per person per day at each stage, in 2023."
        )
        expect(buildSubtitle("protein", 2023)).toBe(
            "Measured as the average grams of protein per person per day at each stage, in 2023."
        )
    })
})
