#! /usr/bin/env yarn jest

import { getBinMaximums, BinningStrategy } from "./BinningStrategies"

describe("BinningStrategies", () => {
    describe(getBinMaximums, () => {
        it("returns no bins for empty array", () => {
            expect(
                getBinMaximums({
                    binningStrategy: BinningStrategy.quantiles,
                    sortedValues: [],
                    binCount: 5
                })
            ).toEqual([])
        })

        it("returns no bins for zero bins", () => {
            expect(
                getBinMaximums({
                    binningStrategy: BinningStrategy.quantiles,
                    sortedValues: [1, 2, 3, 4, 5],
                    binCount: 0
                })
            ).toEqual([])
        })

        describe("ckmeans strategy", () => {
            it("doesn't duplicate bins for skewed distributions", () => {
                expect(
                    getBinMaximums({
                        binningStrategy: BinningStrategy.ckmeans,
                        sortedValues: [1, 1, 1, 1, 1, 5],
                        binCount: 5
                    })
                ).toEqual([1, 5])
            })

            it("excludes bins less than minBinValue", () => {
                expect(
                    getBinMaximums({
                        binningStrategy: BinningStrategy.ckmeans,
                        sortedValues: [1, 1, 1, 1, 1, 5],
                        binCount: 5,
                        minBinValue: 1
                    })
                ).toEqual([5])
            })

            it("handles example", () => {
                expect(
                    getBinMaximums({
                        binningStrategy: BinningStrategy.ckmeans,
                        sortedValues: [1, 2, 4, 5, 12, 43, 52, 123, 234, 1244],
                        binCount: 5
                    })
                ).toEqual([12, 52, 123, 234, 1244])
            })
        })

        describe("quantiles strategy", () => {
            it("doesn't duplicate bins for skewed distributions", () => {
                expect(
                    getBinMaximums({
                        binningStrategy: BinningStrategy.quantiles,
                        sortedValues: [1, 1, 1, 1, 1, 5],
                        binCount: 5
                    })
                ).toEqual([1, 5])
            })

            it("excludes bins less than minBinValue", () => {
                expect(
                    getBinMaximums({
                        binningStrategy: BinningStrategy.quantiles,
                        sortedValues: [1, 1, 1, 1, 1, 5],
                        binCount: 5,
                        minBinValue: 1
                    })
                ).toEqual([5])
            })

            it("handles example", () => {
                expect(
                    getBinMaximums({
                        binningStrategy: BinningStrategy.quantiles,
                        sortedValues: [1, 10, 20, 50, 100],
                        binCount: 4
                    })
                ).toEqual([10, 20, 50, 100])
            })
        })

        describe("equalInterval strategy", () => {
            it("starts from minBinValue", () => {
                expect(
                    getBinMaximums({
                        binningStrategy: BinningStrategy.equalInterval,
                        sortedValues: [300],
                        binCount: 3,
                        minBinValue: 0
                    })
                ).toEqual([100, 200, 300])
            })

            it("derives minBinValue if not specified", () => {
                expect(
                    getBinMaximums({
                        binningStrategy: BinningStrategy.equalInterval,
                        sortedValues: [100, 300],
                        binCount: 2
                    })
                ).toEqual([200, 300])
            })

            it("handles example", () => {
                expect(
                    getBinMaximums({
                        binningStrategy: BinningStrategy.equalInterval,
                        sortedValues: [1, 1.5, 2, 3, 7.5],
                        binCount: 5,
                        minBinValue: 0
                    })
                ).toEqual([2, 4, 6, 8, 10])
            })
        })
    })
})
