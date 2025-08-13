import * as _ from "lodash-es"
import * as R from "remeda"
import { range } from "d3-array"

import { excludeUndefined, roundSigFig } from "@ourworldindata/utils"
import { BinningStrategy } from "@ourworldindata/types"

/** Human-readable labels for the binning strategies */
export const binningStrategyLabels: Record<string, string> = {
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
    const stepSizeInitial = (R.last(sortedValues)! - minBinValue) / binCount
    return roundSigFig(stepSizeInitial, 1)
}

interface GetBinMaximumsWithStrategyArgs {
    binningStrategy: BinningStrategy
    sortedValues: number[]
    binCount: number
    /** `minBinValue` is only used in the `equalInterval` binning strategy. */
    minBinValue?: number
}

// Some algorithms can create bins that start & end at the same value.
// This also means the first bin can both start and end at the same value – the minimum
// value. This is why we uniq() and why we remove any values <= minimum value.
function normalizeBinValues(
    binValues: (number | undefined)[],
    minBinValue?: number
): any {
    const values = _.uniq(excludeUndefined(binValues))
    return minBinValue !== undefined
        ? values.filter((v) => v > minBinValue)
        : values
}

export function getBinMaximums(args: GetBinMaximumsWithStrategyArgs): number[] {
    const { sortedValues, binCount, minBinValue } = args
    const valueCount = sortedValues.length

    if (valueCount < 1 || binCount < 1) return []

    const minValue = minBinValue ?? R.first(sortedValues) ?? 0
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
