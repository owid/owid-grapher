import { describe, expect, it } from "vitest"
import { fakeLogBins } from "./BinningStrategies2.js"

describe("BinningStrategies2", () => {
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
