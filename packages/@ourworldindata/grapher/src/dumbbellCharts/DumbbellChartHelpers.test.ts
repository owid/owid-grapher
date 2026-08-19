import { expect, it, describe } from "vitest"

import { computePercentChange } from "./DumbbellChartHelpers"

describe(computePercentChange, () => {
    it("returns positive change for an increase", () => {
        expect(computePercentChange(100, 150)).toEqual(50)
    })

    it("returns negative change for a decrease", () => {
        expect(computePercentChange(100, 60)).toEqual(-40)
    })

    it("returns 0 when start and end are equal", () => {
        expect(computePercentChange(100, 100)).toEqual(0)
    })

    it("handles two negative values", () => {
        expect(computePercentChange(-50, -25)).toEqual(50)
    })

    it("handles crossing zero from negative to positive", () => {
        // From -100 to 50 is a +150% change relative to |-100|
        expect(computePercentChange(-100, 50)).toEqual(150)
    })

    it("handles crossing zero from positive to negative", () => {
        // From 100 to -50 is a -150% change relative to |100|
        expect(computePercentChange(100, -50)).toEqual(-150)
    })

    it("returns undefined when the start value is zero", () => {
        // Percent change is undefined when the baseline is zero
        expect(computePercentChange(0, 50)).toBeUndefined()
        expect(computePercentChange(0, 0)).toBeUndefined()
        expect(computePercentChange(0, -50)).toBeUndefined()
    })

    it("handles end value of zero", () => {
        expect(computePercentChange(200, 0)).toEqual(-100)
    })
})
