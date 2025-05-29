import { numberMagnitude } from "@ourworldindata/utils"
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
