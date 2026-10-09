import { describe, expect, it } from "vitest"

import {
    buildSubtitle,
    buildTitle,
    buildTruncatedTextWrap,
    formatMeasureValue,
} from "./text.js"

describe(formatMeasureValue, () => {
    it("rounds to the given decimal places", () => {
        expect(formatMeasureValue(1234.5, "energy", { withUnit: false })).toBe(
            "1,235"
        )
        expect(formatMeasureValue(2.21, "protein", { withUnit: false })).toBe(
            "2.2"
        )
    })

    it("shows a small value down to its first significant digit", () => {
        expect(formatMeasureValue(0.034, "protein", { showPlus: true })).toBe(
            "+0.03 g"
        )
        expect(formatMeasureValue(0.4, "energy", { withUnit: false })).toBe(
            "0.4"
        )
        expect(formatMeasureValue(0.0004, "protein", { withUnit: false })).toBe(
            "0.0004"
        )
    })

    it("keeps the sign of a small negative value", () => {
        expect(formatMeasureValue(-0.03, "protein")).toBe("-0.03 g")
    })

    it("keeps the sign of a small value just under the smallest step", () => {
        expect(formatMeasureValue(0.07, "protein", { showPlus: true })).toBe(
            "+0.07 g"
        )
    })

    it("writes zero as zero", () => {
        expect(formatMeasureValue(0, "protein")).toBe("0 g")
    })
})

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

    it("drops the suffix and articulates the European Union", () => {
        expect(buildTitle("European Union (27)", "energy")).toBe(
            "How many calories does the European Union produce, and where do they go?"
        )
    })

    it("asks about an income group in the plural", () => {
        expect(buildTitle("High-income countries", "energy")).toBe(
            "How many calories do high-income countries produce, and where do they go?"
        )
        expect(buildTitle("High-income countries", "protein")).toBe(
            "How much protein do high-income countries produce, and where does it go?"
        )
    })

    it("drops the suffix from Micronesia (country)", () => {
        expect(buildTitle("Micronesia (country)", "energy")).toBe(
            "How many calories does Micronesia produce, and where do they go?"
        )
    })
})

describe(buildTruncatedTextWrap, () => {
    it("keeps a cut text to at most the given lines, however full the last one is", () => {
        const text =
            "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda"
        for (let maxWidth = 60; maxWidth <= 150; maxWidth++) {
            const wrap = buildTruncatedTextWrap({
                text,
                maxWidth,
                maxLines: 2,
                fontSize: 12,
                fontWeight: 400,
            })
            expect(wrap.lines.length).toBeLessThanOrEqual(2)
            expect(wrap.lines.at(-1)!.text.endsWith("…")).toBe(true)
        }
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
