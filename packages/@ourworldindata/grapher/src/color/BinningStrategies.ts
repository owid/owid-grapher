import {
    BinningStrategy,
    MidpointMode,
    ResolvedBinningStrategy,
} from "@ourworldindata/types"
import {
    firstOfNonEmptyArray,
    lastOfNonEmptyArray,
} from "@ourworldindata/utils"
import { quantile } from "d3"
import { sortedUniq } from "lodash-es"
import * as R from "remeda"
import { match, P } from "ts-pattern"
import {
    isLogBinningStrategy,
    runLogBinningStrategy,
} from "./BinningStrategyLogarithmic.js"
import {
    isEqualSizeBinningStrategy,
    runEqualSizeBinningStrategy,
} from "./BinningStrategyEqualSizeBins.js"

export interface BinningStrategyConfig {
    strategy: BinningStrategy
    minValue?: number
    maxValue?: number
    sortedValues: number[] // TODO unsure if needed here
    isPercent?: boolean // TODO unsure if needed here
    numDecimalPlaces?: number // TODO unsure if needed here
    midpointMode?: MidpointMode
    midpoint?: number
    createBinForMidpoint?: boolean
}

export interface ResolvedBinningStrategyConfig {
    strategy: ResolvedBinningStrategy
    minValue?: number
    maxValue?: number
    numDecimalPlaces?: number // TODO unsure if needed here
    sortedValues: number[]
    midpointMode: MidpointMode
    midpoint: number
}

interface BinningStrategyOutput {
    bins: number[]
    midpoint?: number
}

const MANY_ZERO_VALUES_THRESHOLD = 0.1
const AUTO_EQUAL_BINS_MAX_MAGNITUDE_DIFF = 1.2

/**
 * Calculates the log10 difference between two numbers, i.e. compute x such that lowerValue * 10^x = upperValue.
 */
export const calcMagnitudeDiff = (
    lowerValue: number,
    upperValue: number
): number => {
    if (lowerValue > upperValue)
        throw new Error("lowerValue must be less than upperValue")

    return Math.log10(upperValue) - Math.log10(lowerValue)
}

const countValues = (sortedValues: number[], value: number): number => {
    const firstIndex = R.sortedIndex(sortedValues, value)
    const lastIndex = R.sortedLastIndex(sortedValues, value)
    return lastIndex - firstIndex
}

export const pruneUnusedBins = (
    bins: number[],
    { minValue, maxValue }: { minValue?: number; maxValue?: number }
): number[] => {
    if (minValue !== undefined) {
        bins = R.dropWhile(
            bins,
            (v, i) => bins[i + 1] !== undefined && bins[i + 1] <= minValue
        )
    }

    if (maxValue !== undefined) {
        bins = R.dropLastWhile(
            bins,
            (v, i) => bins[i - 1] !== undefined && bins[i - 1] >= maxValue
        )
    }

    return bins
}

export const runBinningStrategy = (
    conf: BinningStrategyConfig
): BinningStrategyOutput => {
    if (conf.sortedValues.length === 0) {
        return { bins: [0] }
    }

    conf.midpoint ??= 0

    const hasValuesBelowMidpoint = conf.sortedValues[0] < conf.midpoint
    const hasValuesAboveMidpoint =
        lastOfNonEmptyArray(conf.sortedValues) > conf.midpoint
    const hasValuesBelowAndAboveMidpoint =
        hasValuesBelowMidpoint && hasValuesAboveMidpoint

    if (hasValuesBelowAndAboveMidpoint && conf.midpointMode === undefined) {
        // Default to symmetric midpoint if there are negative and positive values
        conf.midpointMode ??= "symmetric"
    }

    conf.midpointMode ??= "none"

    // const midpointCount = countValues(conf.sortedValues, conf.midpoint)
    // const hasManyMidpointValues =
    //     midpointCount >= MANY_ZERO_VALUES_THRESHOLD * conf.sortedValues.length
    // conf.createBinForMidpoint ??= hasManyMidpointValues

    let resolvedStrategy: ResolvedBinningStrategy
    if (conf.strategy === "auto") {
        resolvedStrategy = autoChooseBinningStrategy(conf)
    } else {
        resolvedStrategy = conf.strategy as ResolvedBinningStrategy
    }

    const validationResult = hasValidConfigForBinningStrategy(
        conf.strategy,
        conf
    )
    if (!validationResult.valid) return { bins: [0] } // Placeholder binning for invalid configurations

    let bins = runBinningStrategyAroundMidpoint({
        ...conf,
        midpointMode: conf.midpointMode,
        midpoint: conf.midpoint,
        strategy: resolvedStrategy,
    })

    if (conf.createBinForMidpoint) {
        const midpointIdx = R.sortedIndex(bins, conf.midpoint)
        bins = bins.toSpliced(midpointIdx, 0, conf.midpoint)
    }

    return {
        bins,
        midpoint: conf.midpointMode !== "none" ? conf.midpoint : undefined,
    }
}

type MinMaxValueResult = { valid: true } | { valid: false; reason: string }

export const hasValidConfigForBinningStrategy = (
    strategy: BinningStrategy,
    config: { minValue?: number; maxValue?: number; midpoint?: number }
): MinMaxValueResult => {
    const { minValue, maxValue, midpoint } = config

    if (
        minValue !== undefined &&
        maxValue !== undefined &&
        maxValue < minValue
    ) {
        return { valid: false, reason: "minValue is greater than maxValue" }
    }

    return match(strategy)
        .with("auto", () => {
            return { valid: true } as const
        })
        .when(isEqualSizeBinningStrategy, () => {
            return { valid: true } as const
        })
        .when(isLogBinningStrategy, () => {
            if (minValue <= 0 || maxValue <= 0) {
                return {
                    valid: false,
                    reason: "Log binning requires non-zero positive values",
                } as const
            }
            if (midpoint !== undefined && midpoint !== 0) {
                return {
                    valid: false,
                    reason: "Log binning does not support midpoints other than 0",
                } as const
            }
            return { valid: true } as const
        })
        .exhaustive()
}

/**
 * minValue and maxValue may either be explicitly given, or automatically computed from the data.
 * If auto-computed, they are based on some very much heuristic rules, based on quantiles etc.
 */
export const computeMinMaxForStrategy = (
    strategy: ResolvedBinningStrategy,
    sortedValues: number[],
    conf?: Partial<ResolvedBinningStrategyConfig>
): { minValue: number; maxValue: number } => {
    let { minValue, maxValue } = conf || {}
    if (minValue !== undefined && maxValue !== undefined) {
        maxValue = Math.max(minValue, maxValue)
        return { minValue, maxValue }
    }

    match(strategy)
        .with("equalSizeBins-percent", () => {
            // Percent strategy always uses 0 to 100
            minValue ??= 0
            maxValue ??= 100
        })
        .when(isEqualSizeBinningStrategy, () => {
            const uniqValues = sortedUniq(sortedValues)
            minValue ??= quantile(uniqValues, 0.05)
            maxValue ??= quantile(uniqValues, 0.95)
        })
        .when(isLogBinningStrategy, () => {
            const posValues = R.dropWhile(sortedValues, (v) => v <= 0)
            if (posValues.length === 0) {
                throw new Error("Log binning strategy requires positive values")
            }

            const uniqValues = sortedUniq(posValues)
            minValue ??= quantile(uniqValues, 0.15)
            maxValue ??= quantile(uniqValues, 0.995)

            if (minValue === undefined || maxValue === undefined)
                throw new Error("Couldn't obtain minValue or maxValue")

            // Ensure that the min/max values are at least as high as the number of decimals precision.
            // E.g. if we have 1 decimal place, the minimum value should be at least 0.1
            if (conf?.numDecimalPlaces !== undefined) {
                if (minValue > 0)
                    minValue = Math.max(
                        minValue,
                        Math.pow(10, -conf?.numDecimalPlaces)
                    )
                if (maxValue < 0)
                    maxValue = Math.min(
                        maxValue,
                        -Math.pow(10, -conf?.numDecimalPlaces)
                    )
            }
        })
        .exhaustive()

    if (minValue === undefined || maxValue === undefined)
        throw new Error("Couldn't obtain minValue or maxValue")

    // Ensure that we have minValue <= maxValue
    maxValue = Math.max(minValue, maxValue)
    return { minValue, maxValue }
}

const runBinningStrategyAroundMidpoint = (
    conf: ResolvedBinningStrategyConfig
): number[] => {
    if (
        isLogBinningStrategy(conf.strategy) &&
        conf.midpointMode !== "none" &&
        conf.midpoint !== 0
    ) {
        throw new Error(
            "Log binning strategy does not support midpoints other than 0"
        )
    }

    const minValue = firstOfNonEmptyArray(conf.sortedValues)
    const maxValue = lastOfNonEmptyArray(conf.sortedValues)

    const bins = match(conf.midpointMode)
        .with("none", () => {
            return runResolvedBinningStrategy(conf, { hasMidpoint: false })
        })
        .with(P.union("symmetric", "asymmetric"), () => {
            const leftRange = Math.max(conf.midpoint - minValue, 0)
            const rightRange = Math.max(maxValue - conf.midpoint, 0)
            const biggerRange = Math.max(leftRange, rightRange)

            let posValues: number[]
            if (biggerRange === leftRange) {
                posValues = R.takeWhile(
                    conf.sortedValues,
                    (v) => v < conf.midpoint
                )
                    .map((v) => conf.midpoint - v)
                    .reverse()
            } else {
                posValues = R.dropWhile(
                    conf.sortedValues,
                    (v) => v <= conf.midpoint
                ).map((v) => v - conf.midpoint)
            }

            const binsRight = runResolvedBinningStrategy(
                { ...conf, sortedValues: posValues },
                { hasMidpoint: true }
            )
            const bins = mirrorBinsAroundMidpoint(binsRight, conf.midpoint)

            if (conf.midpointMode === "symmetric") {
                return bins
            } else {
                // asymmetric: create bins the same way, but then prune any unused ones

                return pruneUnusedBins(bins, {
                    minValue,
                    maxValue,
                })
            }
        })
        .with("same-num-bins", () => {
            const leftValues = R.takeWhile(
                conf.sortedValues,
                (v) => v < conf.midpoint
            )
                .map((v) => conf.midpoint - v)
                .reverse()

            const rightValues = R.dropWhile(
                conf.sortedValues,
                (v) => v <= conf.midpoint
            ).map((v) => v - conf.midpoint)

            const binsRight = runResolvedBinningStrategy(
                { ...conf, sortedValues: rightValues },
                { hasMidpoint: true }
            ).filter((v) => v !== 0)
            const binsLeft = runResolvedBinningStrategy(
                { ...conf, sortedValues: leftValues },
                { hasMidpoint: true }
            ).filter((v) => v !== 0)

            return [
                ...binsLeft.map((v) => conf.midpoint - v).reverse(),
                conf.midpoint,
                ...binsRight.map((v) => v + conf.midpoint),
            ]
        })
        .with(undefined, () => {
            throw new Error("Invalid unresolved midpoint mode")
        })
        .exhaustive()

    return bins
}

const runResolvedBinningStrategy = (
    conf: ResolvedBinningStrategyConfig,
    { hasMidpoint }: { hasMidpoint: boolean }
): number[] => {
    const { minValue, maxValue } = computeMinMaxForStrategy(
        conf.strategy,
        conf.sortedValues,
        conf
    )
    return match(conf.strategy)
        .when(isEqualSizeBinningStrategy, () =>
            runEqualSizeBinningStrategy(
                { ...conf, minValue, maxValue },
                { hasMidpoint }
            )
        )
        .when(isLogBinningStrategy, () =>
            runLogBinningStrategy(
                { ...conf, minValue, maxValue },
                { hasMidpoint }
            )
        )
        .exhaustive()
}

const autoChooseBinningStrategy = (
    conf: BinningStrategyConfig
): ResolvedBinningStrategy => {
    if (conf.midpointMode !== "none") {
        return "equalSizeBins-normal"
    }

    const posValuesOnly = R.dropWhile(conf.sortedValues, (v) => v <= 0)
    if (posValuesOnly.length === 0) {
        // All values are negative or zero, use equal size bins as a simple fallback (this is rare anyways)
        return "equalSizeBins-normal"
    }

    // If either minValue or maxValue is non-positive, we cannot use log bins
    const hasNegativeMinOrMaxValue =
        (conf.minValue !== undefined && conf.minValue <= 0) ||
        (conf.maxValue !== undefined && conf.maxValue <= 0)

    let minValueForLog, maxValueForLog
    if (hasNegativeMinOrMaxValue) {
        minValueForLog = maxValueForLog = 0
    } else {
        const { minValue, maxValue } = computeMinMaxForStrategy(
            "log-auto",
            posValuesOnly,
            { minValue: conf.minValue, maxValue: conf.maxValue }
        )
        minValueForLog = minValue
        maxValueForLog = maxValue
    }

    const magnitudeDiff = calcMagnitudeDiff(minValueForLog, maxValueForLog)

    if (
        magnitudeDiff < AUTO_EQUAL_BINS_MAX_MAGNITUDE_DIFF ||
        hasNegativeMinOrMaxValue
    ) {
        if (conf.isPercent) {
            const lastValue = lastOfNonEmptyArray(posValuesOnly)
            const percentile99 = quantile(posValuesOnly, 0.99)
            if (
                lastValue <= 100 &&
                percentile99 !== undefined &&
                percentile99 >= 60
            ) {
                return "equalSizeBins-percent"
            }
        }

        return "equalSizeBins-normal"
    }

    return "log-auto"
}

export const mirrorBinsAroundMidpoint = (
    binOffsets: number[],
    midpoint: number
): number[] => {
    const filteredRightBins = binOffsets.filter((v) => v !== 0)
    const leftBins = filteredRightBins.map((v) => midpoint - v).reverse()
    const rightBins = filteredRightBins.map((v) => v + midpoint)
    return [...leftBins, midpoint, ...rightBins]
}
