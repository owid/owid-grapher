import { ckmeans } from "simple-statistics"
import { range, quantile } from "d3-array"

import { excludeUndefined, uniq, last, roundSigFig, first } from "charts/Util"

export enum BinningStrategy {
    equalInterval = "equalInterval",
    quantiles = "quantiles",
    ckmeans = "ckmeans",
    // The `manual` option is ignored in the algorithms below,
    // but it is stored and handled by the chart.
    manual = "manual"
}

/** Human-readable labels for the binning strategies */
export const binningStrategyLabels: Record<BinningStrategy, string> = {
    equalInterval: "Equal-interval",
    quantiles: "Quantiles",
    ckmeans: "Ckmeans",
    manual: "Manual"
}

function calcEqualIntervalStepSize(
    sortedValues: number[],
    binCount: number,
    minBinValue: number
) {
    if (!sortedValues.length) return 10
    const stepSizeInitial = (last(sortedValues)! - minBinValue) / binCount
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
) {
    const values = uniq(excludeUndefined(binValues))
    return minBinValue !== undefined
        ? values.filter(v => v > minBinValue)
        : values
}

export function getBinMaximums(args: GetBinMaximumsWithStrategyArgs): number[] {
    const { binningStrategy, sortedValues, binCount, minBinValue } = args

    if (sortedValues.length < 1 || binCount < 1) return []

    if (binningStrategy === BinningStrategy.ckmeans) {
        const clusters = ckmeans(sortedValues, binCount)
        return normalizeBinValues(clusters.map(last), minBinValue)
    } else if (binningStrategy === BinningStrategy.quantiles) {
        return normalizeBinValues(
            range(1, binCount + 1).map(v =>
                quantile(sortedValues, v / binCount)
            ),
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
            range(1, binCount + 1).map(n => minValue + n * binStepSize),
            minBinValue
        )
    }
}
