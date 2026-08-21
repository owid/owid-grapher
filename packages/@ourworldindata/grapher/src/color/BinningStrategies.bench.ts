import { bench, describe } from "vitest"
import {
    BinningStrategyConfig,
    runBinningStrategy,
} from "./BinningStrategies.js"

// Choropleth maps and scatter color legends call `runBinningStrategy` to derive
// the numeric bin thresholds from the full set of values in the color column.
// It sorts and de-duplicates the values, computes quantiles and (for midpoint
// modes) makes several extra passes over the array, so its cost grows with the
// number of distinct data points.

/** A deterministic, ascending-sorted distribution spanning negative → positive. */
function makeSortedValues(count: number): number[] {
    const values: number[] = []
    for (let i = 0; i < count; i++) {
        // A skewed spread from roughly -200 to +2000
        values.push(Math.round((Math.sin(i) + 1) ** 3 * 250 - 200))
    }
    return values.sort((a, b) => a - b)
}

const values = makeSortedValues(10000)

describe(runBinningStrategy, () => {
    // runBinningStrategy mutates the config it receives (fills in midpoint /
    // midpointMode defaults), so we hand it a fresh config object each iteration
    // while reusing the shared sorted values array.
    bench("auto, 10k values", () => {
        const conf: BinningStrategyConfig = {
            strategy: "auto",
            sortedValues: values,
        }
        runBinningStrategy(conf)
    })

    bench("equalSizeBins-normal, 10k values", () => {
        const conf: BinningStrategyConfig = {
            strategy: "equalSizeBins-normal",
            sortedValues: values,
        }
        runBinningStrategy(conf)
    })

    bench("symmetric midpoint at 0, 10k values", () => {
        const conf: BinningStrategyConfig = {
            strategy: "auto",
            sortedValues: values,
            midpoint: 0,
            midpointMode: "symmetric",
        }
        runBinningStrategy(conf)
    })
})
