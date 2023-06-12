import { ckmeans } from "simple-statistics"
import { range, quantile } from "d3-array"

import {
    excludeUndefined,
    uniq,
    last,
    roundSigFig,
    first,
} from "@ourworldindata/utils"
import { BinningStrategy } from "./BinningStrategy"

/** Human-readable labels for the binning strategies */
export const binningStrategyLabels: Record<BinningStrategy, string> = {
    equalInterval: "Equal-interval",
    quantiles: "Quantiles",
    ckmeans: "Ckmeans",
    manual: "Manual",
}

function calcEqualIntervalStepSize(
    sortedValues: number[],
    binCount: number,
    minBinValue: number
): number {
    if (!sortedValues.length) return 10
    const stepSizeInitial = (last(sortedValues)! - minBinValue) / binCount
    return roundSigFig(stepSizeInitial, 1)
}

interface GetBinMaximumsWithStrategyArgs {
    binningStrategy: BinningStrategy
    sortedValues: number[]
    binCount: number
    /** `minBinValue` and `centerBinValue` are only used in the `equalInterval` binning strategy. */
    minBinValue?: number
    centerBinValue?: number
}

// Some algorithms can create bins that start & end at the same value.
// This also means the first bin can both start and end at the same value – the minimum
// value. This is why we uniq() and why we remove any values <= minimum value.
function normalizeBinValues(
    binValues: (number | undefined)[],
    minBinValue?: number
): any {
    const values = uniq(excludeUndefined(binValues))
    return minBinValue !== undefined
        ? values.filter((v) => v > minBinValue)
        : values
}

export function getBinMaximums(args: GetBinMaximumsWithStrategyArgs): number[] {
    const {
        binningStrategy,
        sortedValues,
        binCount,
        minBinValue,
        centerBinValue,
    } = args
    const valueCount = sortedValues.length

    if (valueCount < 1 || binCount < 1) return []

    if (binningStrategy === BinningStrategy.ckmeans) {
        const clusters = ckmeans(
            sortedValues,
            binCount > valueCount ? valueCount : binCount
        )
        return normalizeBinValues(clusters.map(last), minBinValue)
    } else if (binningStrategy === BinningStrategy.quantiles) {
        return normalizeBinValues(
            range(1, binCount + 1).map((v) =>
                quantile(sortedValues, v / binCount)
            ),
            minBinValue
        )
    } else if (centerBinValue != undefined) {
        // Equal-interval strategy by default, with a customized center value.
        // If a custom center value is given, we construct bins in such a way
        // that the center value is on the edge of a bin

        // enforce an even bin count (necessary to ensure that colors are assigned correctly later on)
        const corrBinCount = binCount % 2 === 1 ? binCount + 1 : binCount

        const minValue = minBinValue ?? sortedValues[0] ?? 0
        const binStepSize = calcEqualIntervalStepSize(
            sortedValues,
            corrBinCount,
            minValue
        )

        const centerBinPosition = Math.ceil(
            (centerBinValue - minValue) / binStepSize
        )
        const nBinsRight = corrBinCount - centerBinPosition
        const nBinsLeft = centerBinPosition - 1

        const leftBinValues = range(nBinsLeft, 0, -1).map(
            (n) => centerBinValue - n * binStepSize
        )
        const rightBinValues = range(1, nBinsRight + 1).map(
            (n) => centerBinValue + n * binStepSize
        )

        return normalizeBinValues(
            [...leftBinValues, centerBinValue, ...rightBinValues],
            minBinValue
        )
    } else {
        // Equal-interval strategy by default
        const minValue = minBinValue ?? first(sortedValues) ?? 0
        const binStepSize = calcEqualIntervalStepSize(
            sortedValues,
            binCount,
            minValue
        )
        return normalizeBinValues(
            range(1, binCount + 1).map((n) => minValue + n * binStepSize),
            minBinValue
        )
    }
}
