import {
    normaliseToSingleDigitNumber,
    numberMagnitude,
    roundSigFig,
} from "@ourworldindata/utils"
import * as R from "remeda"

const log10 = [1]
const log125 = [1, 2, 5]
const log130 = [1, 3]

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

export const mirrorPositiveBinsAroundZeroMidpoint = (
    positiveBins: number[]
): number[] => {
    const filteredPositiveBins = positiveBins.filter((v) => v > 0)
    const negativeBins = filteredPositiveBins.map((v) => -v).reverse()
    return [...negativeBins, 0, ...filteredPositiveBins]
}

export const equalSizeBins = ({
    minValue,
    maxValue,
    midpoint,
    targetBinCount = [5, 8],
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

    const roundedMaxValue = roundSigFig(maxValue, 1)

    // This is an ordered list of the preferred step sizes. E.g, we'd rather have steps 10, 20, 30 instead of 7, 14, 21,
    // if that's possible within our target bin count.
    const preferredStepSizes = [1, 10, 2, 5, 3, 4, 6, 8, 9, 7, 0]

    const stepSizeCandidates = R.range(targetBinCount[0], targetBinCount[1] + 1)
        .map((v) => {
            const stepSize = roundedMaxValue / v
            return roundSigFig(stepSize, 1)
        })
        .filter((candidateStepSize) => {
            const numSteps = Math.ceil(roundedMaxValue / candidateStepSize)
            return (
                numSteps >= targetBinCount[0] && numSteps <= targetBinCount[1]
            )
        })

    const stepSize = R.firstBy(stepSizeCandidates, (v) => {
        const singleDigit = Math.round(normaliseToSingleDigitNumber(v))
        return preferredStepSizes.indexOf(singleDigit)
    })

    if (stepSize === undefined) {
        throw new Error("No valid step size found")
    }

    const steps = Math.ceil(maxValue / stepSize)

    return R.range(0, steps + 1).map((i) => {
        const value = i * stepSize
        return value
    })
}
