import { describe, expect, it } from "vitest"
import { runLogBinningStrategy } from "./BinningStrategyLogarithmic.js"

describe(runLogBinningStrategy, () => {
    describe("log-auto strategy", () => {
        it("should choose log-10 for large magnitude differences", () => {
            const bins = runLogBinningStrategy({
                strategy: "log-auto",
                minValue: 0.01,
                maxValue: 10000, // magnitude diff = 6
                sortedValues: [],
                midpointMode: undefined,
                midpoint: 0,
            })
            // Should use log-10 strategy (only powers of 10)
            expect(bins).toEqual([0, 0.01, 0.1, 1, 10, 100, 1000, 10000])
        })

        it("should choose log-1-3 for medium magnitude differences (>=2.6)", () => {
            const bins = runLogBinningStrategy({
                strategy: "log-auto",
                minValue: 1,
                maxValue: 1000, // magnitude diff = 3
                sortedValues: [],
                midpointMode: undefined,
                midpoint: 0,
            })
            // Should use log-1-3 strategy
            expect(bins).toEqual([0, 1, 3, 10, 30, 100, 300, 1000])
        })

        it("should choose log-1-2-5 for small magnitude differences (<2.6)", () => {
            const bins = runLogBinningStrategy({
                strategy: "log-auto",
                minValue: 1,
                maxValue: 101, // magnitude diff = 2
                sortedValues: [],
                midpointMode: undefined,
                midpoint: 0,
            })
            // Should use log-1-2-5 strategy
            expect(bins).toEqual([0, 1, 2, 5, 10, 20, 50, 100, 200])
        })

        it("should adjust magnitude diff when hasMidpoint is true", () => {
            const bins = runLogBinningStrategy(
                {
                    strategy: "log-auto",
                    minValue: 1,
                    maxValue: 100, // magnitude diff = 2, * 1.8 = 3.6
                    sortedValues: [],
                    midpointMode: undefined,
                    midpoint: 0,
                },
                { hasMidpoint: true }
            )
            // Should use log-10 strategy due to adjustment
            expect(bins).toEqual([1, 10, 100])
        })
    })

    describe("explicit log strategies", () => {
        it("should handle log-10 strategy", () => {
            const bins = runLogBinningStrategy({
                strategy: "log-10",
                minValue: 0.1,
                maxValue: 1000,
                sortedValues: [],
                midpointMode: undefined,
                midpoint: 0,
            })
            expect(bins).toEqual([0, 0.1, 1, 10, 100, 1000])
        })

        it("should handle log-1-3 strategy", () => {
            const bins = runLogBinningStrategy({
                strategy: "log-1-3",
                minValue: 1,
                maxValue: 302,
                sortedValues: [],
                midpointMode: undefined,
                midpoint: 0,
            })
            expect(bins).toEqual([0, 1, 3, 10, 30, 100, 300, 1000])
        })

        it("should handle log-1-2-5 strategy", () => {
            const bins = runLogBinningStrategy({
                strategy: "log-1-2-5",
                minValue: 0.5,
                maxValue: 50,
                sortedValues: [],
                midpointMode: undefined,
                midpoint: 0,
            })
            expect(bins).toEqual([0, 0.5, 1, 2, 5, 10, 20, 50])
        })
    })

    describe("midpoint handling", () => {
        it("should add midpoint when not hasMidpoint and midpoint < first bin", () => {
            const bins = runLogBinningStrategy({
                strategy: "log-10",
                minValue: 10,
                maxValue: 1000,
                sortedValues: [],
                midpointMode: undefined,
                midpoint: 0,
            })
            expect(bins).toEqual([0, 10, 100, 1000])
        })

        it("should not add midpoint when hasMidpoint is true", () => {
            const bins = runLogBinningStrategy(
                {
                    strategy: "log-10",
                    minValue: 10,
                    maxValue: 1000,
                    sortedValues: [],
                    midpointMode: undefined,
                    midpoint: 0,
                },
                { hasMidpoint: true }
            )
            expect(bins).toEqual([10, 100, 1000])
        })
    })

    describe("error handling", () => {
        it("should throw error when minValue <= 0", () => {
            expect(() => {
                runLogBinningStrategy({
                    strategy: "log-10",
                    minValue: 0,
                    maxValue: 100,
                    sortedValues: [],
                    midpointMode: undefined,
                    midpoint: 0,
                })
            }).toThrow("Log binning strategy only supports positive values")
        })

        it("should throw error when maxValue <= 0", () => {
            expect(() => {
                runLogBinningStrategy({
                    strategy: "log-10",
                    minValue: 10,
                    maxValue: -5,
                    sortedValues: [],
                    midpointMode: undefined,
                    midpoint: 0,
                })
            }).toThrow("Log binning strategy only supports positive values")
        })

        it("should throw error when minValue is negative", () => {
            expect(() => {
                runLogBinningStrategy({
                    strategy: "log-10",
                    minValue: -5,
                    maxValue: 100,
                    sortedValues: [],
                    midpointMode: undefined,
                    midpoint: 0,
                })
            }).toThrow("Log binning strategy only supports positive values")
        })
    })

    describe("edge cases", () => {
        it("should handle very small values", () => {
            const bins = runLogBinningStrategy({
                strategy: "log-10",
                minValue: 0.001,
                maxValue: 0.1,
                sortedValues: [],
                midpointMode: undefined,
                midpoint: 0,
            })
            expect(bins).toEqual([0, 0.001, 0.01, 0.1])
        })

        it("should handle very large values", () => {
            const bins = runLogBinningStrategy({
                strategy: "log-10",
                minValue: 10000,
                maxValue: 10000000,
                sortedValues: [],
                midpointMode: undefined,
                midpoint: 0,
            })
            expect(bins).toEqual([0, 10000, 100000, 1000000, 10000000])
        })

        it("should handle equal min and max values", () => {
            const bins = runLogBinningStrategy({
                strategy: "log-10",
                minValue: 10,
                maxValue: 10,
                sortedValues: [],
                midpointMode: undefined,
                midpoint: 0,
            })
            expect(bins).toEqual([0, 10])
        })

        it("should handle single magnitude range", () => {
            const bins = runLogBinningStrategy({
                strategy: "log-auto",
                minValue: 2,
                maxValue: 8,
                sortedValues: [],
                midpointMode: undefined,
                midpoint: 0,
            })
            expect(bins).toEqual([0, 2, 5, 10])
        })
    })
})
