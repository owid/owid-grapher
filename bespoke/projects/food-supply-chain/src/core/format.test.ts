import { describe, expect, it } from "vitest"

import { decimalPlacesForSpan, formatMeasureValue } from "./format.js"

describe(decimalPlacesForSpan, () => {
    it("drops decimals once the span reaches 100", () => {
        expect(decimalPlacesForSpan(35_800)).toBe(0)
    })

    it("keeps two decimals for a span under 10", () => {
        expect(decimalPlacesForSpan(1.7)).toBe(2)
    })
})

describe(formatMeasureValue, () => {
    it("formats an energy-scale value with no decimals", () => {
        expect(formatMeasureValue(1234.5, { span: 35_800 })).toBe("1,235")
    })

    it("formats a mass-scale value with two decimals", () => {
        expect(formatMeasureValue(1.234, { span: 1.7 })).toBe("1.23")
    })
})
