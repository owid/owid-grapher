import { describe, expect, it } from "vitest"
import {
    equalSizeBins,
    fakeLogBins,
    mirrorPositiveBinsAroundZeroMidpoint,
} from "./BinningStrategies2.js"

describe(fakeLogBins, () => {
    it("should generate logarithmic 1, 2, 5 bins", () => {
        const bins = fakeLogBins({
            minValue: 0.3,
            maxValue: 1000,
            logSteps: [1, 2, 5],
        })
        expect(bins).toEqual([
            0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000,
        ])
    })

    it("should generate logarithmic 1, 3 bins", () => {
        const bins = fakeLogBins({
            minValue: 1,
            maxValue: 1000,
            logSteps: [1, 3],
        })
        expect(bins).toEqual([1, 3, 10, 30, 100, 300, 1000])
    })

    it("should generate logarithmic 1, 10 bins", () => {
        const bins = fakeLogBins({
            minValue: 0.05,
            maxValue: 1000,
            logSteps: [1],
        })
        expect(bins).toEqual([0.01, 0.1, 1, 10, 100, 1000])
    })
})

describe(mirrorPositiveBinsAroundZeroMidpoint, () => {
    it("should mirror positive bins around zero midpoint", () => {
        const bins = mirrorPositiveBinsAroundZeroMidpoint([1, 2, 5, 10])
        expect(bins).toEqual([-10, -5, -2, -1, 0, 1, 2, 5, 10])
    })

    it("should handle empty arrays", () => {
        const bins = mirrorPositiveBinsAroundZeroMidpoint([])
        expect(bins).toEqual([0])
    })

    it("should handle single positive value", () => {
        const bins = mirrorPositiveBinsAroundZeroMidpoint([5])
        expect(bins).toEqual([-5, 0, 5])
    })

    it("should handle zero", () => {
        const bins = mirrorPositiveBinsAroundZeroMidpoint([0, 1])
        expect(bins).toEqual([-1, 0, 1])
    })
})

describe(equalSizeBins, () => {
    it("should generate equal width bins", () => {
        const bins = equalSizeBins({
            minValue: 0,
            maxValue: 10,
        })
        expect(bins).toEqual([0, 2, 4, 6, 8, 10])
    })

    it("should handle values", () => {
        const bins = equalSizeBins({
            minValue: 0,
            maxValue: 5,
        })
        expect(bins).toEqual([0, 1, 2, 3, 4, 5])
    })
})
