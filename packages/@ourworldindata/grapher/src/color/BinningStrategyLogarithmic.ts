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
        conf.midpointMode !== "none" &&
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
