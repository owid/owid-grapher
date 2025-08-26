import {
    BinningStrategyIncludingManual,
    EqualSizeBinningStrategy,
    ResolvedBinningStrategy,
} from "@ourworldindata/types"
import {
    normaliseToSingleDigitNumber,
    numberMagnitude,
    RequiredBy,
    roundSigFig,
} from "@ourworldindata/utils"
import * as R from "remeda"
import { match, P } from "ts-pattern"
import { ResolvedBinningStrategyConfig } from "./BinningStrategies.js"

export const isEqualSizeBinningStrategy = (
    strategy: BinningStrategyIncludingManual | ResolvedBinningStrategy
): strategy is EqualSizeBinningStrategy => strategy.startsWith("equalSizeBins-")

export const runEqualSizeBinningStrategy = (
    conf: RequiredBy<ResolvedBinningStrategyConfig, "minValue" | "maxValue">,
    { hasMidpoint }: { hasMidpoint?: boolean } = {}
): number[] => {
    if (!isEqualSizeBinningStrategy(conf.strategy)) {
        throw new Error("Invalid strategy")
    }

    const { minValue, maxValue } = conf
    const targetBinCount = getTargetBinCountForEqualSizeBinsStrategy(
        conf.strategy,
        { hasMidpoint }
    )
    return equalSizeBins({ minValue, maxValue, targetBinCount })
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

    const actualStepSize = stepSize * factor

    // Round min value to step size, e.g. if the step size is 20 then this would round 50 down to 40
    const minValueRounded =
        Math.floor(minValue / actualStepSize) * actualStepSize

    const steps = Math.ceil((maxValue - minValueRounded) / stepSize)

    return R.range(0, steps + 1).map((i) => {
        const value = i * actualStepSize
        return minValueRounded + roundSigFig(value, 3) // to avoid floating point issues
    })
}
