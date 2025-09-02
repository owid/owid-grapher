import {
    BinningStrategyIncludingManual,
    EqualSizeBinningStrategy,
    ResolvedBinningStrategy,
} from "@ourworldindata/types"
import {
    normaliseToSingleDigitNumber,
    RequiredBy,
    roundSigFig,
} from "@ourworldindata/utils"
import * as R from "remeda"
import { match, P } from "ts-pattern"
import { ResolvedBinningStrategyConfig } from "./BinningStrategies.js"
import * as Sentry from "@sentry/browser"

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
    return createEqualSizeBins({ minValue, maxValue, targetBinCount })
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

export const createEqualSizeBins = ({
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
    const { normalised: normalisedRange, factor } =
        normaliseToSingleDigitNumber(range)

    // These are all common and "good" step sizes
    const stepSizeCandidates = [1, 0.1, 0.5, 0.2, 2, 3, 0.3, 0.75, 0.25]

    // Compute the number of bins we would get for each candidate step size
    const stepSizeInfo = stepSizeCandidates.map((candidateStepSize) => {
        // if (normalisedRange === 0) return true

        const numSteps = Math.ceil(normalisedRange / candidateStepSize)
        return { stepSize: candidateStepSize, numSteps }
        // return numSteps >= targetBinCount[0] && numSteps <= targetBinCount[1]
    })

    // Find the first step size that gives us the target bin count
    let stepSize = stepSizeInfo.find(
        (info) =>
            info.numSteps >= targetBinCount[0] &&
            info.numSteps <= targetBinCount[1]
    )?.stepSize

    if (stepSize === undefined) {
        // It could be interesting to see which charts cause this, so we can further look into them
        Sentry.captureMessage(
            "Equal size binning: Couldn't find a step size fitting targetBinCount; instead using next-best candidate",
            {
                level: "warning",
                extra: { targetBinCount, minValue, maxValue },
            }
        )

        // prefer too many bins over too few (by weighing "too many" less highly than "too few")
        const stepSizeDifference = (candidate: number): number =>
            Math.max(candidate - targetBinCount[1], 0) * 1 + // this is how many more bins there are than targetBinCount specifies
            Math.max(targetBinCount[0] - candidate, 0) * 2 // and this is how many fewer there are

        // Find the step size that minimizes the distance function, i.e. such that we are not much above/below what targetBinCount requests
        stepSize = R.firstBy(stepSizeInfo, (info) =>
            stepSizeDifference(info.numSteps)
        )?.stepSize
    }

    if (stepSize === undefined) {
        // This should never happen
        throw new Error("Could not find a valid step size")
    }

    const actualStepSize = stepSize * factor

    // Round min value to step size, e.g. if the step size is 20 then this would round 50 down to 40
    const minValueRounded =
        Math.floor(minValue / actualStepSize) * actualStepSize

    const steps = Math.ceil((maxValue - minValueRounded) / actualStepSize)

    return R.range(0, steps + 1).map((i) => {
        const value = i * actualStepSize
        return minValueRounded + roundSigFig(value, 3) // to avoid floating point issues
    })
}
