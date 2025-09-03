import { numberMagnitude, RequiredBy } from "@ourworldindata/utils"
import {
    BinningStrategyIncludingManual,
    LogBinningStrategy,
    ResolvedLogBinningStrategy,
} from "@ourworldindata/types"
import {
    calcMagnitudeDiff,
    pruneUnusedBins,
    ResolvedBinningStrategyConfig,
} from "./BinningStrategies.js"
import * as R from "remeda"
import { match } from "ts-pattern"

export const isLogBinningStrategy = (
    strategy: BinningStrategyIncludingManual
): strategy is LogBinningStrategy => strategy.startsWith("log-")

/**
 * Automatically chooses a log binning strategy based on the magnitude difference between the min and max values.
 * Very roughly, the resulting number of bins is roughly magnitudeDiff * numberOfLogSteps.
 *
 * The threshold numbers in here are chosen empirically by experimentation.
 * The main idea is that we want to ideally have 5-8 bins, and with the number of resulting bins very roughly
 * being `magnitudeDiff * numberOfLogSteps`, we arrive roughly at these thresholds:
 * - for magnitudeDiff < 2.6, and 3 log steps, we'll end up with up to 8 bins
 * - for magnitudeDiff between 2.6 and 3.6, and 2 log steps, we'll end up with 5 to 8 bins
 * - for magnitudeDiff >= 3.6, and 1 log step, we'll end up with >=4 bins
 * - ... there's probably also cases where we can end up with more than 8 bins, but these should be pretty rare
 *   (and in these case, the authors can still manually choose a different strategy)
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

export const runLogBinningStrategy = (
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
            createLogBins({ minValue, maxValue, logSteps: [1] })
        )
        .with("log-1-3", () =>
            createLogBins({ minValue, maxValue, logSteps: [1, 3] })
        )
        .with("log-1-2-5", () =>
            createLogBins({ minValue, maxValue, logSteps: [1, 2, 5] })
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

const createLogBins = ({
    minValue,
    maxValue,
    logSteps,
}: {
    minValue: number
    maxValue: number
    logSteps: number[]
}): number[] => {
    if (minValue <= 0 || maxValue <= 0) {
        throw new Error("createLogBins only supports positive values")
    }

    // We need the -1 here to convert between magnitude and logarithms.
    // Magnitude is defined such that magnitude(1) = 1, whereas log10(1) = 0.
    // Because we generate factors as 10^magnitude, we need to adjust the values accordingly.
    const exponentMin = numberMagnitude(minValue) - 1
    const exponentMax = numberMagnitude(maxValue) - 1

    const candidates = R.range(exponentMin, exponentMax + 1).flatMap(
        (magnitude) => {
            const factor = Math.pow(10, magnitude)
            return logSteps.map((step) => step * factor)
        }
    )

    // Adding this extra value at the end is useful if we have, for example, maxValue = 99.
    // Then the candidates above will go up to 50 (if logSteps includes 5), and here we'll then
    // add 100 to the mix.
    if ((R.last(candidates) ?? 0) < maxValue) {
        candidates.push(1 * Math.pow(10, exponentMax + 1))
    }

    return pruneUnusedBins(candidates, { minValue, maxValue })
}
