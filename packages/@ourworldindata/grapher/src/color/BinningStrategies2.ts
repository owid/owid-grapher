import {
    firstOfNonEmptyArray,
    lastOfNonEmptyArray,
    normaliseToSingleDigitNumber,
    numberMagnitude,
    RequiredBy,
    roundSigFig,
} from "@ourworldindata/utils"
import { min, quantile } from "d3"
import { sortedUniq } from "lodash-es"
import * as R from "remeda"
import { match, P } from "ts-pattern"

/**
 * Strategies:
 * - The log scales result in log-like steps, e.g. 1, 2, 5, 10, ...
 *   They are fully defined given a minValue, maxValue and step size, and
 *   then generate as many bins as needed to cover the range.
 *   `log-auto` chooses the step size automatically in order to get a decent number of bins.
 * - The equal size bins result in evenly spaced steps, e.g. 0, 1, 2, 3, ...
 *   They are defined by a minValue, maxValue, and a rough target number of bins.
 *   `equalSizeBins-few-bins` chooses a small number of bins, while
 *   `equalSizeBins-many-bins` chooses a large number of bins.
 *   They then generate nice round bin thresholds given the input data.
 * - `equalSizeBins-percent` is a special case, where for data that looks like percent
 *   from 0% to 100% we want to mostly use 0%, 10%, 20%, etc. bins.
 */

type LogBinningStrategy = "log-1-2-5" | "log-1-3" | "log-10" | "log-auto"
type EqualSizeBinningStrategy =
    | "equalSizeBins-few-bins"
    | "equalSizeBins-normal"
    | "equalSizeBins-many-bins"
    | "equalSizeBins-percent"

type ResolvedLogBinningStrategy = Exclude<LogBinningStrategy, "log-auto">

type BinningStrategy = "auto" | EqualSizeBinningStrategy | LogBinningStrategy

type ResolvedBinningStrategy = Exclude<BinningStrategy, "auto">

export const automaticBinningStrategies: BinningStrategy[] = [
    "auto",

    "log-auto",
    "log-1-2-5",
    "log-1-3",
    "log-10",

    "equalSizeBins-few-bins",
    "equalSizeBins-normal",
    "equalSizeBins-many-bins",
    "equalSizeBins-percent",
]

/**
 * Sometimes, we do have a midpoint in our data. In many cases, a natural midpoint is zero
 * (e.g. for year-over-year change, net migration, temperature anomaly, etc.), but other
 * midpoints also make sense (e.g. for sex ratio).
 * If we have a midpoint, then we want to account for it when binning, and generate bins
 * that are centered or symmetric around the midpoint.
 */
type MidpointMode =
    | "none" // No midpoint
    | "symmetric" // Symmetric bins around a midpoint, with negBins = -1 * posBins
    | "same-num-bins" // Symmetric bins around a midpoint, with negBins.length = posBins.length
    | "asymmetric" // Bins around a midpoint, with negBins.length not necessarily equal to posBins.length

interface BinningStrategyConfig {
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

interface ResolvedBinningStrategyConfig {
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
const calcMagnitudeDiff = (lowerValue: number, upperValue: number): number => {
    if (lowerValue > upperValue)
        throw new Error("lowerValue must be less than upperValue")

    return Math.log10(upperValue) - Math.log10(lowerValue)
}

const countValues = (sortedValues: number[], value: number): number => {
    const firstIndex = R.sortedIndex(sortedValues, value)
    const lastIndex = R.sortedLastIndex(sortedValues, value)
    return lastIndex - firstIndex
}

const isEqualSizeBinningStrategy = (
    strategy: BinningStrategy | ResolvedBinningStrategy
): strategy is EqualSizeBinningStrategy => strategy.startsWith("equalSizeBins-")

const isLogBinningStrategy = (
    strategy: BinningStrategy | ResolvedBinningStrategy
): strategy is LogBinningStrategy => strategy.startsWith("log-")

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

    const midpointCount = countValues(conf.sortedValues, conf.midpoint)
    const hasManyMidpointValues =
        midpointCount >= MANY_ZERO_VALUES_THRESHOLD * conf.sortedValues.length
    conf.createBinForMidpoint ??= hasManyMidpointValues

    let resolvedStrategy: ResolvedBinningStrategy
    if (conf.strategy === "auto") {
        resolvedStrategy = autoChooseBinningStrategy(conf)
    } else {
        resolvedStrategy = conf.strategy as ResolvedBinningStrategy
    }

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

export const hasValidMinMaxValuesForBinningStrategy = (
    strategy: BinningStrategy,
    { minValue, maxValue }: { minValue?: number; maxValue?: number } = {}
): MinMaxValueResult => {
    if (minValue === undefined || maxValue === undefined) {
        // Values will be determined automatically; no need for validation
        return { valid: true }
    }

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
            return { valid: true } as const
        })
        .exhaustive()
}

/**
 * minValue and maxValue may either be explicitly given, or automatically computed from the data.
 * If auto-computed, they are based on some very much heuristic rules, based on quantiles etc.
 */
const computeMinMaxForStrategy = (
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
        .exhaustive()

    return bins
}

/**
 * The equal-size binning strategies all operate with a range of target bins depending on the strategy.
 * For example, [5, 9] means that there should be at least 5 bins and at most 9.
 * If there is a midpoint, the number of bins needs to be adjusted downward, because we are potentially
 * creating up to twice as many bins overall.
 */
const getTargetBinCountForEqualSizeBinsStrategy = (
    strategy: EqualSizeBinningStrategy,
    { hasMidpoint }: { hasMidpoint?: boolean } = {}
): readonly [number, number] => {
    return match(strategy)
        .with("equalSizeBins-few-bins", () =>
            hasMidpoint ? ([1, 3] as const) : ([2, 5] as const)
        )
        .with("equalSizeBins-normal", () =>
            hasMidpoint ? ([3, 6] as const) : ([5, 9] as const)
        )
        .with(
            P.union("equalSizeBins-many-bins", "equalSizeBins-percent"),
            () => (hasMidpoint ? ([4, 8] as const) : ([8, 12] as const))
        )
        .exhaustive()
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
            equalSizeBins({
                minValue,
                maxValue,
                targetBinCount: getTargetBinCountForEqualSizeBinsStrategy(
                    conf.strategy as EqualSizeBinningStrategy,
                    { hasMidpoint }
                ),
            })
        )
        .when(isLogBinningStrategy, () =>
            runLogBinningStrategy(
                { ...conf, minValue, maxValue },
                { hasMidpoint }
            )
        )
        .exhaustive()
}

/**
 * Automatically chooses a log binning strategy based on the magnitude difference between the min and max values.
 * Very roughly, the resulting number of bins is roughly magnitudeDiff * numberOfLogSteps.
 */
const autoChooseLogBinningStrategy = (
    magnitudeDiff: number
): ResolvedLogBinningStrategy => {
    if (magnitudeDiff >= 3.6) {
        return "log-10"
    }
    if (magnitudeDiff >= 2.6) {
        return "log-1-3"
    }
    return "log-1-2-5"
}

const runLogBinningStrategy = (
    conf: RequiredBy<ResolvedBinningStrategyConfig, "minValue" | "maxValue">,
    { hasMidpoint }: { hasMidpoint?: boolean } = {}
): number[] => {
    const { minValue, maxValue } = conf

    if (minValue <= 0 || maxValue <= 0) {
        throw new Error("Log binning strategy only supports positive values")
    }

    let resolvedStrategy: ResolvedLogBinningStrategy
    if (conf.strategy === "log-auto") {
        let magnitudeDiff = calcMagnitudeDiff(minValue, maxValue)
        if (hasMidpoint) magnitudeDiff *= 1.8 // If there is a midpoint, we want to create fewer bins than we would otherwise
        resolvedStrategy = autoChooseLogBinningStrategy(magnitudeDiff)
    } else {
        resolvedStrategy = conf.strategy as ResolvedLogBinningStrategy
    }

    const bins = match(resolvedStrategy)
        .with("log-10", () =>
            fakeLogBins({ minValue, maxValue, logSteps: [1] })
        )
        .with("log-1-3", () =>
            fakeLogBins({ minValue, maxValue, logSteps: [1, 3] })
        )
        .with("log-1-2-5", () =>
            fakeLogBins({ minValue, maxValue, logSteps: [1, 2, 5] })
        )
        .exhaustive()

    // Add the midpoint (most likely zero) if it is not already included in a bin
    if (
        !hasMidpoint &&
        conf.midpoint !== undefined &&
        bins[0] > conf.midpoint
    ) {
        bins.unshift(conf.midpoint)
    }

    return bins
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

const fakeLogBins = ({
    minValue,
    maxValue,
    logSteps,
}: {
    minValue: number
    maxValue: number
    logSteps: number[]
}): number[] => {
    if (minValue <= 0 || maxValue <= 0) {
        throw new Error("fakeLogBins only supports positive values")
    }

    const magnitudeMin = numberMagnitude(minValue) - 1
    const magnitudeMax = numberMagnitude(maxValue) - 1

    const candidates = R.range(magnitudeMin, magnitudeMax + 1).flatMap(
        (magnitude) => {
            const factor = Math.pow(10, magnitude)
            return logSteps.map((step) => step * factor)
        }
    )

    if ((R.last(candidates) ?? 0) < maxValue) {
        candidates.push(1 * Math.pow(10, magnitudeMax + 1))
    }

    return pruneUnusedBins(candidates, { minValue, maxValue })
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

export const equalSizeBins = ({
    minValue,
    maxValue,
    targetBinCount,
}: {
    minValue: number
    maxValue: number
    targetBinCount: readonly number[]
}): number[] => {
    if (minValue > maxValue) {
        throw new Error("minValue must be less than maxValue")
    }

    const range = maxValue - minValue

    // Normalise the range to be within 1 and 10
    const normalisedRange = normaliseToSingleDigitNumber(range)
    // This is the factor used to un-normalise the values back to their original scale
    const factor = Math.pow(10, numberMagnitude(range) - 1)

    // These are all common and "good" step sizes; find the first one that gives us the target bin count
    const stepSizeCandidates = [1, 0.1, 0.5, 0.2, 2, 3, 0.3, 0.75, 0.25]
    const stepSize = stepSizeCandidates.find((candidateStepSize) => {
        if (normalisedRange === 0) return true

        const numSteps = Math.ceil(normalisedRange / candidateStepSize)
        return numSteps >= targetBinCount[0] && numSteps <= targetBinCount[1]
    })

    if (stepSize === undefined) {
        throw new Error("No valid step size found")
    }

    const steps = Math.ceil(normalisedRange / stepSize)

    const actualStepSize = stepSize * factor

    // Round min value to step size
    const minValueRounded =
        Math.floor(minValue / actualStepSize) * actualStepSize

    return R.range(0, steps + 1).map((i) => {
        const value = i * actualStepSize
        return minValueRounded + roundSigFig(value, 3) // to avoid floating point issues
    })
}
