import { describe, expect, it } from "vitest"

import {
    formatFlopInWords,
    formatPowerOfTenTick,
    formatScientific,
} from "./formatFlop.js"
import {
    getLinearYMax,
    getLinearYTicks,
    getYearTicks,
    getYExponentDomain,
    getYTickExponents,
} from "./axes.js"
import { placeLabels } from "./labelPlacement.js"
import { getComputeRange } from "./uncertainty.js"

describe(formatFlopInWords, () => {
    it.each([
        [40, "40"],
        [4_000, "4,000"],
        [1.5e6, "1.5 million"],
        [9.4e26, "940 septillion"],
        [3.14e23, "310 sextillion"],
        [1e27, "1 octillion"],
        // Rounding up across a power of ten
        [9.96e25, "100 septillion"],
        // Rounding up across a scale boundary picks the larger name
        [999_999_999, "1 billion"],
    ])("%d → %s", (value, expected) => {
        expect(formatFlopInWords(value)).toBe(expected)
    })

    it("labels axis ticks at exact powers of ten", () => {
        expect(formatPowerOfTenTick(3)).toBe("1,000")
        expect(formatPowerOfTenTick(14)).toBe("100 trillion")
        expect(formatPowerOfTenTick(24)).toBe("1 septillion")
    })
})

describe(formatScientific, () => {
    it("uses superscript exponents and drops a mantissa of 1", () => {
        expect(formatScientific(9.4e26)).toBe("9.4 × 10²⁶")
        expect(formatScientific(1e25)).toBe("10²⁵")
        expect(formatScientific(9.97e25)).toBe("10²⁶")
    })
})

describe(getYExponentDomain, () => {
    it("starts at 1 for the full history and snaps to labeled gridlines when zoomed", () => {
        // Theseus (40 FLOP) to GPT-6 Astra (9.4 × 10²⁶)
        expect(getYExponentDomain([40, 9.4e26])).toEqual([0, 28])
        // Zoomed into the deep learning era
        expect(getYExponentDomain([5e15, 9.4e26])).toEqual([15, 28])
    })
})

describe(getYTickExponents, () => {
    it("labels every thousandfold step, or every second one when space is tight", () => {
        expect(getYTickExponents([0, 28], 500)).toEqual([
            0, 3, 6, 9, 12, 15, 18, 21, 24, 27,
        ])
        expect(getYTickExponents([21, 27], 500)).toEqual([21, 24, 27])
        expect(getYTickExponents([0, 28], 200)).toEqual([0, 6, 12, 18, 24])
    })
})

describe(getYearTicks, () => {
    it("uses round steps that leave room for the labels", () => {
        expect(getYearTicks([1940, 2027], 600)).toEqual([
            1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020,
        ])
        expect(getYearTicks([2020, 2027], 600)).toEqual([
            2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027,
        ])
    })
})

describe(placeLabels, () => {
    const bounds = { x: 0, y: 0, width: 100, height: 100 }
    const box = (x: number, y: number) => ({ x, y, width: 20, height: 10 })

    it("moves a label to its next option when the first collides", () => {
        const placed = placeLabels(
            [
                { item: "a", options: [box(0, 0)] },
                { item: "b", options: [box(5, 0), box(5, 30)] },
            ],
            bounds
        )
        expect(placed.map((p) => [p.item, p.optionIndex])).toEqual([
            ["a", 0],
            ["b", 1],
        ])
    })

    it("drops labels with no free option, including outside the bounds", () => {
        const placed = placeLabels(
            [
                { item: "a", options: [box(0, 0)] },
                { item: "b", options: [box(5, 0), box(95, 50)] },
            ],
            bounds
        )
        expect(placed.map((p) => p.item)).toEqual(["a"])
    })
})

describe(getComputeRange, () => {
    it("spans the estimate divided and multiplied by Epoch's factor", () => {
        // Compare in orders of magnitude, clear of floating-point noise
        const log = (range?: [number, number]) => range?.map(Math.log10)
        const [low, high] = log(getComputeRange(1e25, "Likely"))!
        expect(low).toBeCloseTo(24)
        expect(high).toBeCloseTo(26)
        const [cLow, cHigh] = log(getComputeRange(1e25, "Confident"))!
        expect(cHigh - cLow).toBeCloseTo(2 * Math.log10(3))
        const [sLow, sHigh] = log(getComputeRange(1e25, "Speculative"))!
        expect(sHigh - sLow).toBeCloseTo(2 * Math.log10(31))
    })

    it("has no range for labels without a stated interval", () => {
        expect(getComputeRange(1e25, "Unknown")).toBeUndefined()
        expect(getComputeRange(1e25, undefined)).toBeUndefined()
    })
})

describe(getLinearYMax, () => {
    it("leaves headroom over the largest value and rounds it", () => {
        for (const max of [4.8e26, 9.6e25, 3.1e24]) {
            const yMax = getLinearYMax([1e20, max])
            expect(yMax).toBeGreaterThanOrEqual(max * 1.05)
            expect(yMax).toBeLessThan(max * 1.5)
        }
    })

    it("falls back to 1 without positive values", () => {
        expect(getLinearYMax([])).toBe(1)
    })
})

describe(getLinearYTicks, () => {
    it("starts at zero and stays within the domain", () => {
        const ticks = getLinearYTicks(6e26, 400)
        expect(ticks[0]).toBe(0)
        expect(ticks.at(-1)).toBeLessThanOrEqual(6e26)
        expect(ticks.length).toBeGreaterThanOrEqual(3)
    })

    it("uses fewer ticks on short plots", () => {
        expect(getLinearYTicks(6e26, 120).length).toBeLessThan(
            getLinearYTicks(6e26, 600).length
        )
    })
})
