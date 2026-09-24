import { describe, expect, it } from "vitest"

import { computeAxisRange } from "./layout.js"

describe(computeAxisRange, () => {
    it("starts a linear axis at zero and rounds the top up to a tick", () => {
        const range = computeAxisRange([1.9, 12.4, 23.2], "linear")
        expect(range.domain[0]).toBe(0)
        expect(range.domain[1]).toBeGreaterThanOrEqual(23.2)
        expect(range.ticks[0]).toBe(0)
        expect(range.ticks.at(-1)).toBe(range.domain[1])
    })

    it("snaps a log axis to 1, 2 or 5 times a power of ten", () => {
        const range = computeAxisRange([510, 174_000], "log")
        expect(range.domain).toEqual([500, 200_000])
        expect(range.ticks).toEqual([1_000, 10_000, 100_000])
    })

    it("adds intermediate log ticks when a decade would give too few", () => {
        const range = computeAxisRange([2.5, 8], "log")
        expect(range.domain).toEqual([2, 10])
        expect(range.ticks.length).toBeGreaterThanOrEqual(2)
    })

    it("copes with no values", () => {
        expect(computeAxisRange([], "linear").domain).toEqual([0, 1])
        expect(computeAxisRange([], "log").domain).toEqual([1, 10])
    })
})
