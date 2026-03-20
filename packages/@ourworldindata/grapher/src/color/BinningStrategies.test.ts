import { describe, expect, it } from "vitest"
import {
    mirrorBinsAroundMidpoint,
    pruneUnusedBins,
    runBinningStrategy,
} from "./BinningStrategies.js"

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

    it("should handle non-zero midpoint", () => {
        const bins = mirrorBinsAroundMidpoint([1, 2, 5], 105)
        expect(bins).toEqual([100, 103, 104, 105, 106, 107, 110])
    })
})

describe(pruneUnusedBins, () => {
    it("should remove unused bins", () => {
        const bins = [0, 1, 2, 3, 4, 5]
        const prunedBins = pruneUnusedBins(bins, { minValue: 1, maxValue: 4.2 })
        expect(prunedBins).toEqual([1, 2, 3, 4, 5])
    })
})

describe(runBinningStrategy, () => {
    it("uses few-bins instead of log for wide positive ranges in auto mode", () => {
        const sortedValues = [1, 2, 5, 10, 20, 50, 100, 300, 1000]

        expect(
            runBinningStrategy({
                strategy: "auto",
                sortedValues,
                midpointMode: "none",
                midpoint: 0,
            }).bins
        ).toEqual(
            runBinningStrategy({
                strategy: "equalSizeBins-few-bins",
                sortedValues,
                midpointMode: "none",
                midpoint: 0,
            }).bins
        )
    })
})
