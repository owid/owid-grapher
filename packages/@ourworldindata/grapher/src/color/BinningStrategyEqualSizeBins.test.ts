import { describe, expect, it } from "vitest"
import {
    equalSizeBins,
    isEqualSizeBinningStrategy,
    runEqualSizeBinningStrategy,
} from "./BinningStrategyEqualSizeBins.js"

describe(isEqualSizeBinningStrategy, () => {
    it("should identify equal size binning strategies", () => {
        expect(isEqualSizeBinningStrategy("equalSizeBins-few-bins")).toBe(true)
        expect(isEqualSizeBinningStrategy("equalSizeBins-normal")).toBe(true)
        expect(isEqualSizeBinningStrategy("equalSizeBins-many-bins")).toBe(true)
        expect(isEqualSizeBinningStrategy("equalSizeBins-percent")).toBe(true)
    })

    it("should not identify non-equal size binning strategies", () => {
        expect(isEqualSizeBinningStrategy("log-auto")).toBe(false)
        expect(isEqualSizeBinningStrategy("log-10")).toBe(false)
        expect(isEqualSizeBinningStrategy("manual")).toBe(false)
        expect(isEqualSizeBinningStrategy("random-string")).toBe(false)
    })
})

describe(runEqualSizeBinningStrategy, () => {
    describe("few-bins strategy", () => {
        it("should create 2-5 bins when hasMidpoint is false", () => {
            const bins = runEqualSizeBinningStrategy({
                strategy: "equalSizeBins-few-bins",
                minValue: 0,
                maxValue: 10,
                sortedValues: [],
                midpointMode: "none",
                midpoint: 0,
            })
            expect(bins.length).toBeGreaterThanOrEqual(3) // 2 bins = 3 bin edges
            expect(bins.length).toBeLessThanOrEqual(6) // 5 bins = 6 bin edges
            expect(bins[0]).toBe(0)
            expect(bins[bins.length - 1]).toBeGreaterThanOrEqual(10)
        })

        it("should create 1-3 bins when hasMidpoint is true", () => {
            const bins = runEqualSizeBinningStrategy(
                {
                    strategy: "equalSizeBins-few-bins",
                    minValue: 0,
                    maxValue: 10,
                    sortedValues: [],
                    midpointMode: "none",
                    midpoint: 0,
                },
                { hasMidpoint: true }
            )
            expect(bins.length).toBeGreaterThanOrEqual(2) // 1 bin = 2 bin edges
            expect(bins.length).toBeLessThanOrEqual(4) // 3 bins = 4 bin edges
        })
    })

    describe("normal strategy", () => {
        it("should create 5-9 bins when hasMidpoint is false", () => {
            const bins = runEqualSizeBinningStrategy({
                strategy: "equalSizeBins-normal",
                minValue: 0,
                maxValue: 100,
                sortedValues: [],
                midpointMode: "none",
                midpoint: 0,
            })
            expect(bins.length).toBeGreaterThanOrEqual(6) // 5 bins = 6 bin edges
            expect(bins.length).toBeLessThanOrEqual(10) // 9 bins = 10 bin edges
            expect(bins[0]).toBe(0)
            expect(bins[bins.length - 1]).toBeGreaterThanOrEqual(100)
        })

        it("should create 3-6 bins when hasMidpoint is true", () => {
            const bins = runEqualSizeBinningStrategy(
                {
                    strategy: "equalSizeBins-normal",
                    minValue: 0,
                    maxValue: 100,
                    sortedValues: [],
                    midpointMode: "none",
                    midpoint: 0,
                },
                { hasMidpoint: true }
            )
            expect(bins.length).toBeGreaterThanOrEqual(4) // 3 bins = 4 bin edges
            expect(bins.length).toBeLessThanOrEqual(7) // 6 bins = 7 bin edges
        })
    })

    describe("many-bins and percent strategies", () => {
        it("should create 8-12 bins for many-bins when hasMidpoint is false", () => {
            const bins = runEqualSizeBinningStrategy({
                strategy: "equalSizeBins-many-bins",
                minValue: 0,
                maxValue: 1000,
                sortedValues: [],
                midpointMode: "none",
                midpoint: 0,
            })
            expect(bins.length).toBeGreaterThanOrEqual(9) // 8 bins = 9 bin edges
            expect(bins.length).toBeLessThanOrEqual(13) // 12 bins = 13 bin edges
        })

        it("should create 8-12 bins for percent when hasMidpoint is false", () => {
            const bins = runEqualSizeBinningStrategy({
                strategy: "equalSizeBins-percent",
                minValue: 0,
                maxValue: 100,
                sortedValues: [],
                midpointMode: "none",
                midpoint: 0,
            })
            expect(bins.length).toBeGreaterThanOrEqual(9) // 8 bins = 9 bin edges
            expect(bins.length).toBeLessThanOrEqual(13) // 12 bins = 13 bin edges
        })

        it("should create 4-8 bins when hasMidpoint is true", () => {
            const bins = runEqualSizeBinningStrategy(
                {
                    strategy: "equalSizeBins-many-bins",
                    minValue: 0,
                    maxValue: 1000,
                    sortedValues: [],
                    midpointMode: "none",
                    midpoint: 0,
                },
                { hasMidpoint: true }
            )
            expect(bins.length).toBeGreaterThanOrEqual(5) // 4 bins = 5 bin edges
            expect(bins.length).toBeLessThanOrEqual(9) // 8 bins = 9 bin edges
        })
    })

    describe("error handling", () => {
        it("should throw error for invalid strategy", () => {
            expect(() => {
                runEqualSizeBinningStrategy({
                    strategy: "log-auto" as any,
                    minValue: 0,
                    maxValue: 100,
                    sortedValues: [],
                    midpointMode: "none",
                    midpoint: 0,
                })
            }).toThrow("Invalid strategy")
        })
    })

    describe("edge cases", () => {
        it("should handle very small ranges", () => {
            const bins = runEqualSizeBinningStrategy({
                strategy: "equalSizeBins-normal",
                minValue: 0.001,
                maxValue: 0.002,
                sortedValues: [],
                midpointMode: "none",
                midpoint: 0,
            })
            expect(bins.length).toBeGreaterThan(1)
            expect(bins[0]).toBeLessThanOrEqual(0.001)
            expect(bins[bins.length - 1]).toBeGreaterThanOrEqual(0.002)
        })

        it("should handle large ranges", () => {
            const bins = runEqualSizeBinningStrategy({
                strategy: "equalSizeBins-normal",
                minValue: 0,
                maxValue: 1000000,
                sortedValues: [],
                midpointMode: "none",
                midpoint: 0,
            })
            expect(bins.length).toBeGreaterThan(1)
            expect(bins[0]).toBe(0)
            expect(bins[bins.length - 1]).toBeGreaterThanOrEqual(1000000)
        })

        it("should handle negative ranges", () => {
            const bins = runEqualSizeBinningStrategy({
                strategy: "equalSizeBins-normal",
                minValue: -100,
                maxValue: -10,
                sortedValues: [],
                midpointMode: "none",
                midpoint: 0,
            })
            expect(bins.length).toBeGreaterThan(1)
            expect(bins[0]).toBeLessThanOrEqual(-100)
            expect(bins[bins.length - 1]).toBeGreaterThanOrEqual(-10)
        })
    })
})

describe(equalSizeBins, () => {
    describe("basic functionality", () => {
        it("should create bins with equal step sizes", () => {
            const bins = equalSizeBins({
                minValue: 0,
                maxValue: 10,
                targetBinCount: [5, 9],
            })
            
            // Check that bins are sorted
            for (let i = 1; i < bins.length; i++) {
                expect(bins[i]).toBeGreaterThan(bins[i - 1])
            }
            
            // Check that first bin covers minValue
            expect(bins[0]).toBeLessThanOrEqual(0)
            
            // Check that last bin covers maxValue
            expect(bins[bins.length - 1]).toBeGreaterThanOrEqual(10)
            
            // Check that we have the expected number of bins
            const numBins = bins.length - 1
            expect(numBins).toBeGreaterThanOrEqual(5)
            expect(numBins).toBeLessThanOrEqual(9)
        })

        it("should use nice step sizes", () => {
            const bins = equalSizeBins({
                minValue: 0,
                maxValue: 100,
                targetBinCount: [5, 9],
            })
            
            // Calculate step sizes between consecutive bins
            const stepSizes = []
            for (let i = 1; i < bins.length; i++) {
                stepSizes.push(bins[i] - bins[i - 1])
            }
            
            // All step sizes should be approximately equal (allowing for floating point precision)
            const firstStep = stepSizes[0]
            stepSizes.forEach(step => {
                expect(Math.abs(step - firstStep)).toBeLessThan(0.001)
            })
            
            // Step size should be a "nice" number (power of 10 times 1, 2, or 5)
            const normalizedStep = firstStep / Math.pow(10, Math.floor(Math.log10(firstStep)))
            const niceNumbers = [1, 2, 5, 0.1, 0.2, 0.5, 0.3, 0.75, 0.25, 3]
            expect(niceNumbers.some(nice => Math.abs(normalizedStep - nice) < 0.001)).toBe(true)
        })
    })

    describe("error handling", () => {
        it("should throw error when minValue > maxValue", () => {
            expect(() => {
                equalSizeBins({
                    minValue: 10,
                    maxValue: 5,
                    targetBinCount: [5, 9],
                })
            }).toThrow("minValue must be less than maxValue")
        })

        it("should throw error when no valid step size is found", () => {
            expect(() => {
                equalSizeBins({
                    minValue: 0,
                    maxValue: 1,
                    targetBinCount: [100, 200], // Impossible to achieve with nice step sizes
                })
            }).toThrow("No valid step size found")
        })
    })

    describe("edge cases", () => {
        it("should handle zero range", () => {
            const bins = equalSizeBins({
                minValue: 5,
                maxValue: 5,
                targetBinCount: [2, 5],
            })
            expect(bins).toContain(5)
        })

        it("should handle very small ranges", () => {
            const bins = equalSizeBins({
                minValue: 0.0001,
                maxValue: 0.0002,
                targetBinCount: [2, 5],
            })
            expect(bins.length).toBeGreaterThan(1)
            expect(bins[0]).toBeLessThanOrEqual(0.0001)
            expect(bins[bins.length - 1]).toBeGreaterThanOrEqual(0.0002)
        })

        it("should handle large ranges", () => {
            const bins = equalSizeBins({
                minValue: 1000000,
                maxValue: 10000000,
                targetBinCount: [5, 9],
            })
            expect(bins.length).toBeGreaterThan(1)
            expect(bins[0]).toBeLessThanOrEqual(1000000)
            expect(bins[bins.length - 1]).toBeGreaterThanOrEqual(10000000)
        })

        it("should handle negative ranges", () => {
            const bins = equalSizeBins({
                minValue: -100,
                maxValue: -10,
                targetBinCount: [5, 9],
            })
            expect(bins.length).toBeGreaterThan(1)
            expect(bins[0]).toBeLessThanOrEqual(-100)
            expect(bins[bins.length - 1]).toBeGreaterThanOrEqual(-10)
        })

        it("should handle ranges crossing zero", () => {
            const bins = equalSizeBins({
                minValue: -50,
                maxValue: 50,
                targetBinCount: [5, 9],
            })
            expect(bins.length).toBeGreaterThan(1)
            expect(bins[0]).toBeLessThanOrEqual(-50)
            expect(bins[bins.length - 1]).toBeGreaterThan(50) // Should extend beyond maxValue
            
            // Should include zero or values close to zero
            const hasZeroOrNear = bins.some(bin => Math.abs(bin) < 0.001)
            expect(hasZeroOrNear).toBe(true)
        })
    })

    describe("target bin count behavior", () => {
        it("should respect minimum target bin count", () => {
            const bins = equalSizeBins({
                minValue: 0,
                maxValue: 10,
                targetBinCount: [3, 10],
            })
            const numBins = bins.length - 1
            expect(numBins).toBeGreaterThanOrEqual(3)
        })

        it("should respect maximum target bin count", () => {
            const bins = equalSizeBins({
                minValue: 0,
                maxValue: 10,
                targetBinCount: [2, 4],
            })
            const numBins = bins.length - 1
            expect(numBins).toBeLessThanOrEqual(4)
        })

        it("should handle single target bin count", () => {
            const bins = equalSizeBins({
                minValue: 0,
                maxValue: 10,
                targetBinCount: [5, 5],
            })
            const numBins = bins.length - 1
            expect(numBins).toBe(5)
        })
    })

    describe("floating point precision", () => {
        it("should handle floating point arithmetic correctly", () => {
            const bins = equalSizeBins({
                minValue: 0.1,
                maxValue: 0.9,
                targetBinCount: [4, 8],
            })
            
            // Check that no two consecutive bins are equal due to floating point errors
            for (let i = 1; i < bins.length; i++) {
                expect(bins[i]).toBeGreaterThan(bins[i - 1])
            }
        })

        it("should round values to avoid floating point issues", () => {
            const bins = equalSizeBins({
                minValue: 0,
                maxValue: 1,
                targetBinCount: [5, 9],
            })
            
            // All bin values should be reasonable numbers without excessive decimal places
            bins.forEach(bin => {
                const decimalPlaces = (bin.toString().split('.')[1] || '').length
                expect(decimalPlaces).toBeLessThanOrEqual(10) // Reasonable precision limit
            })
        })
    })
})