import type { EqualSizeBinningStrategy } from "@ourworldindata/types"
import { describe, expect, it } from "vitest"
import {
    createEqualSizeBins,
    runEqualSizeBinningStrategy,
} from "./BinningStrategyEqualSizeBins.js"

function expectBinsCoverRange(
    bins: number[],
    minValue: number,
    maxValue: number
): void {
    expect(
        bins[0],
        "first edge should include the minimum"
    ).toBeLessThanOrEqual(minValue)
    expect(
        bins.at(-1),
        "last edge should include the maximum"
    ).toBeGreaterThanOrEqual(maxValue)
}

function runStrategy({
    strategy,
    minValue,
    maxValue,
    hasMidpoint = false,
}: {
    strategy: EqualSizeBinningStrategy
    minValue: number
    maxValue: number
    hasMidpoint?: boolean
}): number[] {
    return runEqualSizeBinningStrategy(
        {
            strategy,
            minValue,
            maxValue,
            sortedValues: [],
            midpointMode: "none",
            midpoint: 0,
        },
        { hasMidpoint }
    )
}

describe(runEqualSizeBinningStrategy, () => {
    // Strategy names express a desired density rather than an exact count.
    // These cases protect each density band and the deliberate reduction made
    // when a midpoint may cause the final bin set to be mirrored.
    describe("strategy density", () => {
        const cases: {
            label: string
            strategy: EqualSizeBinningStrategy
            minValue: number
            maxValue: number
            hasMidpoint?: boolean
            expectedBinCount: readonly [number, number]
        }[] = [
            {
                label: "few bins",
                strategy: "equalSizeBins-few-bins",
                minValue: 0,
                maxValue: 10,
                expectedBinCount: [2, 5],
            },
            {
                label: "few bins with a midpoint",
                strategy: "equalSizeBins-few-bins",
                minValue: 0,
                maxValue: 10,
                hasMidpoint: true,
                expectedBinCount: [1, 3],
            },
            {
                label: "normal density",
                strategy: "equalSizeBins-normal",
                minValue: 0,
                maxValue: 100,
                expectedBinCount: [5, 9],
            },
            {
                label: "normal density with a midpoint",
                strategy: "equalSizeBins-normal",
                minValue: 0,
                maxValue: 100,
                hasMidpoint: true,
                expectedBinCount: [3, 6],
            },
            {
                label: "many bins",
                strategy: "equalSizeBins-many-bins",
                minValue: 0,
                maxValue: 1000,
                expectedBinCount: [8, 12],
            },
            {
                label: "percent bins",
                strategy: "equalSizeBins-percent",
                minValue: 0,
                maxValue: 100,
                expectedBinCount: [8, 12],
            },
            {
                label: "many bins with a midpoint",
                strategy: "equalSizeBins-many-bins",
                minValue: 0,
                maxValue: 1000,
                hasMidpoint: true,
                expectedBinCount: [4, 8],
            },
        ]

        it.each(cases)(
            "$label stays within its target density and covers the data",
            ({ expectedBinCount, ...config }) => {
                const bins = runStrategy(config)
                const binCount = bins.length - 1

                expect(binCount).toBeGreaterThanOrEqual(expectedBinCount[0])
                expect(binCount).toBeLessThanOrEqual(expectedBinCount[1])
                expectBinsCoverRange(bins, config.minValue, config.maxValue)
            }
        )
    })

    it("rejects a strategy from a different binning family", () => {
        expect(() => {
            runEqualSizeBinningStrategy({
                strategy: "log-auto",
                minValue: 0,
                maxValue: 100,
                sortedValues: [],
                midpointMode: "none",
                midpoint: 0,
            })
        }).toThrow("Invalid strategy")
    })

    // The strategy wrapper must preserve range coverage across changes in
    // scale and sign. These are representative numeric partitions; the
    // underlying edge-generation contract is tested in more detail below.
    it.each([
        { label: "a sub-unit range", minValue: 0.001, maxValue: 0.002 },
        { label: "a million-unit range", minValue: 0, maxValue: 1_000_000 },
        { label: "an entirely negative range", minValue: -100, maxValue: -10 },
    ])("covers $label", ({ minValue, maxValue }) => {
        const bins = runStrategy({
            strategy: "equalSizeBins-normal",
            minValue,
            maxValue,
        })

        expect(bins.length).toBeGreaterThan(1)
        expectBinsCoverRange(bins, minValue, maxValue)
    })
})

describe(createEqualSizeBins, () => {
    // Equal-size bins must be ordered, uniformly spaced, cover the requested
    // domain, and normally remain inside the requested count range.
    it("creates uniformly spaced bins that cover the domain", () => {
        const bins = createEqualSizeBins({
            minValue: 0,
            maxValue: 10,
            targetBinCount: [5, 9],
        })
        const stepSizes = bins.slice(1).map((bin, index) => bin - bins[index])

        expectBinsCoverRange(bins, 0, 10)
        expect(bins.length - 1).toBeGreaterThanOrEqual(5)
        expect(bins.length - 1).toBeLessThanOrEqual(9)
        expect(stepSizes.every((step) => step === stepSizes[0])).toBe(true)
    })

    it("chooses a human-readable step size", () => {
        const bins = createEqualSizeBins({
            minValue: 0,
            maxValue: 100,
            targetBinCount: [5, 9],
        })
        const firstStep = bins[1] - bins[0]
        const normalizedStep =
            firstStep / Math.pow(10, Math.floor(Math.log10(firstStep)))
        const supportedNormalizedSteps = [
            1, 2, 5, 0.1, 0.2, 0.5, 0.3, 0.75, 0.25, 3,
        ]

        expect(
            supportedNormalizedSteps.some(
                (candidate) => Math.abs(normalizedStep - candidate) < 0.001
            )
        ).toBe(true)
    })

    it("rejects a reversed domain", () => {
        expect(() => {
            createEqualSizeBins({
                minValue: 10,
                maxValue: 5,
                targetBinCount: [5, 9],
            })
        }).toThrow("minValue must be less than maxValue")
    })

    it("chooses the closest supported density when the target is impossible", () => {
        expect(
            createEqualSizeBins({
                minValue: 0,
                maxValue: 1,
                targetBinCount: [100, 200],
            })
        ).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1])
    })

    // Scale and sign should not change the core coverage contract. Crossing
    // zero is kept separate because zero itself becomes a meaningful edge.
    it.each([
        { label: "sub-unit values", minValue: 0.0001, maxValue: 0.0002 },
        {
            label: "million-scale values",
            minValue: 1_000_000,
            maxValue: 10_000_000,
        },
        { label: "negative values", minValue: -100, maxValue: -10 },
    ])("covers a domain with $label", ({ minValue, maxValue }) => {
        const bins = createEqualSizeBins({
            minValue,
            maxValue,
            targetBinCount: [2, 9],
        })

        expect(bins.length).toBeGreaterThan(1)
        expectBinsCoverRange(bins, minValue, maxValue)
    })

    it("keeps zero as an edge when the domain crosses zero", () => {
        const bins = createEqualSizeBins({
            minValue: -50,
            maxValue: 50,
            targetBinCount: [5, 9],
        })

        expectBinsCoverRange(bins, -50, 50)
        expect(bins).toContain(0)
    })

    it("represents a zero-width domain without losing its value", () => {
        const bins = createEqualSizeBins({
            minValue: 5,
            maxValue: 5,
            targetBinCount: [2, 5],
        })

        expect(bins).toContain(5)
    })

    // Count ranges are soft only when no supported step can satisfy them. The
    // representative cases below establish the lower, upper, and exact forms.
    it.each([
        {
            label: "a minimum",
            targetBinCount: [3, 10] as const,
            expectedBinCount: [3, 10] as const,
        },
        {
            label: "a maximum",
            targetBinCount: [2, 4] as const,
            expectedBinCount: [2, 4] as const,
        },
        {
            label: "an exact count",
            targetBinCount: [5, 5] as const,
            expectedBinCount: [5, 5] as const,
        },
    ])("respects $label target", ({ targetBinCount, expectedBinCount }) => {
        const bins = createEqualSizeBins({
            minValue: 0,
            maxValue: 10,
            targetBinCount,
        })
        const binCount = bins.length - 1

        expect(binCount).toBeGreaterThanOrEqual(expectedBinCount[0])
        expect(binCount).toBeLessThanOrEqual(expectedBinCount[1])
    })

    // Floating-point rounding must never collapse adjacent edges or expose
    // machine-noise tails in serialized chart configuration.
    it("keeps fractional edges strictly increasing", () => {
        const bins = createEqualSizeBins({
            minValue: 0.1,
            maxValue: 0.9,
            targetBinCount: [4, 8],
        })

        for (let index = 1; index < bins.length; index++) {
            expect(bins[index]).toBeGreaterThan(bins[index - 1])
        }
    })

    it("limits decimal noise in fractional edges", () => {
        const bins = createEqualSizeBins({
            minValue: 0,
            maxValue: 1,
            targetBinCount: [5, 9],
        })

        for (const bin of bins) {
            const decimalPlaces = (bin.toString().split(".")[1] || "").length
            expect(decimalPlaces).toBeLessThanOrEqual(10)
        }
    })
})
