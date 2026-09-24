import { describe, expect, it } from "vitest"

import { formatMeasureValue } from "./format.js"

describe(formatMeasureValue, () => {
    it("rounds to the given decimal places", () => {
        expect(formatMeasureValue(1234.5, { numDecimalPlaces: 0 })).toBe(
            "1,235"
        )
        expect(formatMeasureValue(2.21, { numDecimalPlaces: 1 })).toBe("2.2")
    })

    it("writes a small positive value as below the smallest shown step", () => {
        expect(
            formatMeasureValue(0.03, {
                numDecimalPlaces: 1,
                unit: "g",
                showPlus: true,
            })
        ).toBe("+<0.1 g")
        expect(formatMeasureValue(0.3, { numDecimalPlaces: 0 })).toBe("<1")
    })

    it("keeps the sign of a small negative value", () => {
        expect(
            formatMeasureValue(-0.03, { numDecimalPlaces: 1, unit: "g" })
        ).toBe("-<0.1 g")
    })

    it("writes zero as zero", () => {
        expect(formatMeasureValue(0, { numDecimalPlaces: 1, unit: "g" })).toBe(
            "0 g"
        )
    })

    it("rounds a value at the rounding boundary normally", () => {
        expect(formatMeasureValue(-0.05, { numDecimalPlaces: 1 })).toBe("-0.1")
    })
})
