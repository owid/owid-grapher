import {
    firstOfNonEmptyArray,
    lastOfNonEmptyArray,
    normaliseToSingleDigitNumber,
    numberMagnitude,
    RequiredBy,
    roundSigFig,
} from "@ourworldindata/utils"
import { quantile } from "d3"
import { sortedUniq } from "lodash-es"
import * as R from "remeda"
import { match } from "ts-pattern"

type LogBinningStrategy = "log-fake-2" | "log-fake-3" | "log-10" | "log-auto"
type ResolvedLogBinningStrategy = Exclude<LogBinningStrategy, "log-auto">

type BinningStrategy = "auto" | "equalSizeBins" | LogBinningStrategy | "percent"

type ResolvedBinningStrategy = Exclude<BinningStrategy, "auto">

// TODO aspirational
type MidpointMode =
    | "none" // No midpoint
    | "symmetric-full" // Symmetric bins around a midpoint, with negBins = -1 * posBins
    | "symmetric-num-bins" // Symmetric bins around a midpoint, with negBins.length = posBins.length
    | "asymmetric" // Bins around a midpoint, with negBins.length not necessarily equal to posBins.length

interface BinningStrategyConfig {
    strategy: BinningStrategy
    minValue?: number
    maxValue?: number
    sortedValues: number[] // TODO unsure if needed here
    isPercent?: boolean // TODO unsure if needed here
    midpointMode?: MidpointMode
    midpoint?: number
    createBinForMidpoint?: boolean
}

interface ResolvedBinningStrategyConfig {
    strategy: ResolvedBinningStrategy
    minValue?: number
    maxValue?: number
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

const isLogBinningStrategy = (
    strategy: BinningStrategy | ResolvedBinningStrategy
): strategy is LogBinningStrategy => strategy.startsWith("log-")

export const runBinningStrategy = (
    conf: BinningStrategyConfig
): BinningStrategyOutput => {
    if (conf.sortedValues.length === 0) {
        return { bins: [0] }
    }

    const hasNegValues = conf.sortedValues[0] < 0
    const hasPosValues = lastOfNonEmptyArray(conf.sortedValues) > 0
    const hasNegAndPosValues = hasNegValues && hasPosValues
    const hasOnlyNegValues = hasNegValues && !hasPosValues

    if (hasNegAndPosValues && conf.midpointMode === undefined) {
        // Default to symmetric-full if there are negative and positive values
        conf.midpointMode ??= "symmetric-full"
    }

    conf.midpoint ??= 0
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

const computeMinMaxForStrategy = (
    strategy: ResolvedBinningStrategy,
    sortedValues: number[],
    conf?: ResolvedBinningStrategyConfig
): { minValue: number; maxValue: number } => {
    if (conf?.minValue !== undefined && conf?.maxValue !== undefined) {
        return { minValue: conf.minValue, maxValue: conf.maxValue }
    }

    return match(strategy)
        .with("equalSizeBins", () => {
            const uniqValues = sortedUniq(sortedValues)
            const minValue = quantile(uniqValues, 0.05)
            const maxValue = quantile(uniqValues, 0.95)
            return { minValue, maxValue }
        })
        .with("percent", () => {
            // Percent strategy always uses 0 to 100
            return { minValue: 0, maxValue: 100 }
        })
        .when(isLogBinningStrategy, () => {
            const posValues = R.dropWhile(sortedValues, (v) => v <= 0)
            if (posValues.length === 0) {
                throw new Error("Log binning strategy requires positive values")
            }

            const uniqValues = sortedUniq(posValues)
            const minValue = quantile(uniqValues, 0.15)
            const maxValue = quantile(uniqValues, 0.995)

            return { minValue, maxValue }
        })
        .exhaustive()
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
        .with("symmetric-full", () => {
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
            return mirrorBinsAroundMidpoint(binsRight, conf.midpoint)
        })
        .with("symmetric-num-bins", () => {
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
        .with("asymmetric", () => {
            // TODO implement, but how?
            return []
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
        .with("equalSizeBins", () =>
            equalSizeBins({
                minValue,
                maxValue,
                targetBinCount: hasMidpoint
                    ? IDEAL_TARGET_BIN_COUNT_WITH_MIDPOINT
                    : IDEAL_TARGET_BIN_COUNT,
            })
        )
        .with("percent", () =>
            equalSizeBins({
                minValue,
                maxValue,
                targetBinCount: hasMidpoint ? [6, 10] : [3, 5],
            })
        )
        .when(isLogBinningStrategy, () =>
            runLogBinningStrategy({ ...conf, minValue, maxValue })
        )
        .exhaustive()
}

const autoChooseLogBinningStrategy = (
    magnitudeDiff: number
): ResolvedLogBinningStrategy => {
    if (magnitudeDiff >= 3.6) {
        return "log-10"
    }
    if (magnitudeDiff >= 2.6) {
        return "log-fake-3"
    }
    return "log-fake-2"
}

const runLogBinningStrategy = (
    conf: RequiredBy<ResolvedBinningStrategyConfig, "minValue" | "maxValue">
): number[] => {
    const { minValue, maxValue } = conf

    if (minValue <= 0 || maxValue <= 0) {
        throw new Error("Log binning strategy only supports positive values")
    }

    let resolvedStrategy: ResolvedLogBinningStrategy
    if (conf.strategy === "log-auto") {
        const magnitudeDiff = calcMagnitudeDiff(minValue, maxValue)
        resolvedStrategy = autoChooseLogBinningStrategy(magnitudeDiff)
    } else {
        resolvedStrategy = conf.strategy as ResolvedLogBinningStrategy
    }

    return match(resolvedStrategy)
        .with("log-10", () =>
            fakeLogBins({ minValue, maxValue, logSteps: [1] })
        )
        .with("log-fake-3", () =>
            fakeLogBins({ minValue, maxValue, logSteps: [1, 3] })
        )
        .with("log-fake-2", () =>
            fakeLogBins({ minValue, maxValue, logSteps: [1, 2, 5] })
        )
        .exhaustive()
}

const autoChooseBinningStrategy = (
    conf: BinningStrategyConfig
): ResolvedBinningStrategy => {
    if (conf.midpointMode !== "none") {
        return "equalSizeBins"
    }

    const posValuesOnly = R.dropWhile(conf.sortedValues, (v) => v <= 0)
    if (posValuesOnly.length === 0) {
        // All values are negative or zero, use equal size bins as a simple fallback (this is rare anyways)
        return "equalSizeBins"
    }

    const { minValue, maxValue } = computeMinMaxForStrategy(
        "log-auto",
        posValuesOnly
    )

    const magnitudeDiff = calcMagnitudeDiff(minValue, maxValue)

    if (magnitudeDiff < AUTO_EQUAL_BINS_MAX_MAGNITUDE_DIFF) {
        if (conf.isPercent) {
            const lastValue = lastOfNonEmptyArray(posValuesOnly)
            if (lastValue <= 100 && lastValue >= 40) {
                return "percent"
            }
        }

        return "equalSizeBins"
    }

    return "log-auto"
}

const log10 = [1]
const log125 = [1, 2, 5]
const log13 = [1, 3]

const IDEAL_TARGET_BIN_COUNT = [5, 9]
const IDEAL_TARGET_BIN_COUNT_WITH_MIDPOINT = [3, 5]

export const autoChooseLogBins = ({
    minValue,
    maxValue,
}: {
    minValue: number
    maxValue: number
}): number[] => {
    if (minValue <= 0 || maxValue <= 0) {
        throw new Error("autoChooseLogBins only supports positive values")
    }

    const magnitudeDiff = Math.log10(maxValue) - Math.log10(minValue)

    console.log(magnitudeDiff)

    if (magnitudeDiff >= 3.6) {
        return fakeLogBins({
            minValue,
            maxValue,
            logSteps: log10,
        })
    } else if (magnitudeDiff >= 2.6) {
        return fakeLogBins({
            minValue,
            maxValue,
            logSteps: log13,
        })
    } else {
        return fakeLogBins({
            minValue,
            maxValue,
            logSteps: log125,
        })
    }
}

export const fakeLogBins = ({
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

    // These are number between 1 and 9.99999
    const normalisedMin = minValue / Math.pow(10, magnitudeMin)
    const normalisedMax = maxValue / Math.pow(10, magnitudeMax)

    // Find the steps we should use at the beginning.
    // If minValue is 0.3 (and thus, normalisedMin is 3) and logSteps are [1, 2, 5],
    // we want to place a first step at 0.2, and arrive at logSteps [2, 5].
    const firstSteps = R.dropWhile(
        logSteps,
        (step, i) =>
            logSteps[i + 1] !== undefined && logSteps[i + 1] < normalisedMin
    )

    const lastSteps = R.dropLastWhile(
        logSteps,
        (step, i) =>
            logSteps[i - 1] !== undefined && logSteps[i - 1] >= normalisedMax
    )

    const candidates = R.range(magnitudeMin, magnitudeMax + 1).flatMap(
        (magnitude) => {
            const factor = Math.pow(10, magnitude)

            if (magnitude === magnitudeMin)
                return firstSteps.map((step) => step * factor)

            if (magnitude === magnitudeMax)
                return lastSteps.map((step) => step * factor)

            // For all other magnitudes, we use the full set of steps
            return logSteps.map((step) => step * factor)
        }
    )

    if (R.last(candidates) < maxValue) {
        candidates.push(1 * Math.pow(10, magnitudeMax + 1))
    }

    return candidates
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
    targetBinCount = IDEAL_TARGET_BIN_COUNT,
}: {
    minValue: number
    maxValue: number
    targetBinCount?: number[]
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

export const equalSizeBinsWithMidpoint = ({
    minValue,
    maxValue,
    midpoint,
}: {
    minValue: number
    maxValue: number
    midpoint: number
    targetBinCount?: number[]
}): number[] => {
    const rangeOnOneSide = Math.max(
        Math.abs(midpoint - minValue),
        Math.abs(maxValue - midpoint)
    )
    const bins = equalSizeBins({
        minValue: 0,
        maxValue: rangeOnOneSide,
        targetBinCount: [3, 4],
    })

    const mirroredBins = mirrorBinsAroundMidpoint(bins, midpoint)

    const negBins = equalSizeBins({
        minValue: Math.min(minValue - midpoint, midpoint),
        maxValue: midpoint,
        targetBinCount: [3, 4],
    })
    const posBins = equalSizeBins({
        minValue: midpoint,
        maxValue: Math.max(maxValue - midpoint, midpoint),
        targetBinCount: [3, 4],
    })
    return [...negBins, midpoint, ...posBins]
}
