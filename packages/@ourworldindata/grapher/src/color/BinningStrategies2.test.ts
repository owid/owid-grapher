import { describe, expect, it } from "vitest"
import {
    equalSizeBins,
    equalSizeBinsWithMidpoint,
    fakeLogBins,
    mirrorBinsAroundMidpoint,
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

    it("should generate logarithmic 1, 3 bins", () => {
        const bins = fakeLogBins({
            minValue: 1,
            maxValue: 4000,
            logSteps: [1, 3],
        })
        expect(bins).toEqual([1, 3, 10, 30, 100, 300, 1000, 3000, 10000])
    })

    it("should generate logarithmic 1, 10 bins", () => {
        const bins = fakeLogBins({
            minValue: 0.05,
            maxValue: 1000,
            logSteps: [1],
        })
        expect(bins).toEqual([0.01, 0.1, 1, 10, 100, 1000])
    })

    it("should generate logarithmic 1, 10 bins", () => {
        const bins = fakeLogBins({
            minValue: 0.05,
            maxValue: 1001,
            logSteps: [1],
        })
        expect(bins).toEqual([0.01, 0.1, 1, 10, 100, 1000, 10000])
    })
})

describe(mirrorBinsAroundMidpoint, () => {
    it("should mirror positive bins around zero midpoint", () => {
        const bins = mirrorBinsAroundMidpoint([1, 2, 5, 10], 0)
        expect(bins).toEqual([-10, -5, -2, -1, 0, 1, 2, 5, 10])
    })

    it("should handle empty arrays", () => {
        const bins = mirrorBinsAroundMidpoint([], 0)
        expect(bins).toEqual([0])
    })

    it("should handle single positive value", () => {
        const bins = mirrorBinsAroundMidpoint([5], 0)
        expect(bins).toEqual([-5, 0, 5])
    })

    it("should handle zero", () => {
        const bins = mirrorBinsAroundMidpoint([0, 1], 0)
        expect(bins).toEqual([-1, 0, 1])
    })

    it("should handle non-.zero midpoint", () => {
        const bins = mirrorBinsAroundMidpoint([1, 2, 5], 105)
        expect(bins).toEqual([100, 103, 104, 105, 106, 107, 110])
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

    it("should handle percent scale", () => {
        const bins = equalSizeBins({
            minValue: 0,
            maxValue: 100,
            targetBinCount: [10, 10],
        })
        expect(bins).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100])
    })
})

describe(equalSizeBinsWithMidpoint, () => {
    it("should generate bins with midpoint", () => {
        const bins = equalSizeBinsWithMidpoint({
            minValue: 0,
            maxValue: 10,
            midpoint: 5,
        })
        expect(bins).toEqual([-1, 1, 3, 5, 7, 9, 11])
    })

    it("should handle negative values with midpoint", () => {
        const bins = equalSizeBinsWithMidpoint({
            minValue: -10,
            maxValue: 10,
            midpoint: 0,
        })
        expect(bins).toEqual([-10, -7.5, -5, -2.5, 0, 2.5, 5, 7.5, 10])
    })

    it("should handle single value at midpoint", () => {
        const bins = equalSizeBinsWithMidpoint({
            minValue: 5,
            maxValue: 12,
            midpoint: 10,
        })
        expect(bins).toEqual([4, 6, 8, 10, 12, 14, 16])
    })
    it("should handle minValue equal to midpoint", () => {
        const bins = equalSizeBinsWithMidpoint({
            minValue: 25,
            maxValue: 50,
            midpoint: 25,
        })
        expect(bins).toEqual([-5, 5, 15, 25, 35, 45, 55])
    })

    it("should handle minValue equal to midpoint", () => {
        const bins = equalSizeBinsWithMidpoint({
            minValue: 0,
            maxValue: 25,
            midpoint: 25,
        })
        expect(bins).toEqual([-5, 5, 15, 25, 35, 45, 55])
    })
})
