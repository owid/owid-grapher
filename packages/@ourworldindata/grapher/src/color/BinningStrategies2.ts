import {
    normaliseToSingleDigitNumber,
    numberMagnitude,
    roundSigFig,
} from "@ourworldindata/utils"
import * as R from "remeda"

const log10 = [1]
const log125 = [1, 2, 5]
const log13 = [1, 3]

const IDEAL_TARGET_BIN_COUNT = [5, 8]

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

    if (magnitudeDiff >= 5) {
        return fakeLogBins({
            minValue,
            maxValue,
            logSteps: log10,
        })
    } else if (magnitudeDiff >= 3) {
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
    midpoint,
    targetBinCount = IDEAL_TARGET_BIN_COUNT,
}: {
    minValue: number
    maxValue: number
    midpoint?: number
    targetBinCount?: number[]
}): number[] => {
    if (minValue > maxValue) {
        throw new Error("minValue must be less than maxValue")
    }

    const hasNegativeValues = minValue < 0
    if (hasNegativeValues && midpoint === undefined) {
        midpoint = 0
    }

    const hasMidpoint = midpoint !== undefined

    if (!hasNegativeValues && !hasMidpoint) {
        minValue = 0
    }

    // Normalise the max to be within 1 and 10
    const normalisedMax = normaliseToSingleDigitNumber(maxValue)
    // This is the factor used to un-normalise the values back to their original scale
    const factor = Math.pow(10, numberMagnitude(maxValue) - 1)

    // These are all common and "good" step sizes; find the first one that gives us the target bin count
    const stepSizeCandidates = [1, 0.1, 0.5, 0.25, 0.2, 2, 0.75, 3, 0.3]
    const stepSize = stepSizeCandidates.find((candidateStepSize) => {
        const numSteps = Math.ceil(normalisedMax / candidateStepSize)
        return numSteps >= targetBinCount[0] && numSteps <= targetBinCount[1]
    })

    if (stepSize === undefined) {
        throw new Error("No valid step size found")
    }

    const steps = Math.ceil(normalisedMax / stepSize)

    return R.range(0, steps + 1).map((i) => {
        const value = i * stepSize * factor
        return roundSigFig(value, 2) // to avoid floating point issues
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

    return mirrorBinsAroundMidpoint(bins, midpoint)
}
