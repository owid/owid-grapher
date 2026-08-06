import { bench, describe } from "vitest"
import { CoreValueType, Time } from "@ourworldindata/types"
import {
    ErrorValueTypes,
    linearInterpolation,
    toleranceInterpolation,
    computeRollingAverage,
} from "./index.js"

// These are the innermost numeric kernels of the table transform pipeline.
// Grapher runs them once per entity group whenever a chart applies tolerance,
// linear interpolation or a rolling-average smoothing, so they sit directly on
// the hot path between "data loaded" and "chart drawn". We feed them synthetic
// single-entity time series so the benchmark measures the loop itself, free of
// table-construction overhead.

interface SparseSeries {
    values: CoreValueType[]
    times: Time[]
    validIndices: number[]
}

/**
 * Build a single-entity time series of `length` points where roughly every
 * `gapEvery`-th point carries a value and the rest are gaps to be filled in.
 * Deterministic (no randomness) so numbers are comparable across runs.
 */
function makeSparseSeries(length: number, gapEvery: number): SparseSeries {
    const values: CoreValueType[] = []
    const times: Time[] = []
    const validIndices: number[] = []
    for (let i = 0; i < length; i++) {
        times.push(1900 + i)
        if (i % gapEvery === 0) {
            values.push(100 + Math.sin(i / 7) * 50)
            validIndices.push(i)
        } else {
            values.push(ErrorValueTypes.MissingValuePlaceholder)
        }
    }
    return { values, times, validIndices }
}

/** A dense numeric array for rolling-average smoothing. */
function makeDenseValues(length: number): number[] {
    const values: number[] = []
    for (let i = 0; i < length; i++)
        values.push(1000 + Math.sin(i / 5) * 200 + i)
    return values
}

const small = makeSparseSeries(120, 4) // ~1 variable, 120 years, gaps every 4th
const large = makeSparseSeries(2000, 4) // long daily-ish series with many gaps

describe(linearInterpolation, () => {
    // The kernels mutate their input in place, so each iteration works on a
    // fresh copy — otherwise the second run would only measure the fully-filled
    // short-circuit. slice() is a cheap native copy relative to the loop.
    const context = { extrapolateAtStart: true, extrapolateAtEnd: true }

    bench("120 points, gaps every 4th", () => {
        linearInterpolation(
            small.values.slice(),
            small.times,
            [...small.validIndices],
            context
        )
    })

    bench("2000 points, gaps every 4th", () => {
        linearInterpolation(
            large.values.slice(),
            large.times,
            [...large.validIndices],
            context
        )
    })
})

describe(toleranceInterpolation, () => {
    const context = { timeToleranceForwards: 5, timeToleranceBackwards: 5 }

    bench("120 points, tolerance 5", () => {
        toleranceInterpolation(
            small.values.slice(),
            small.times.slice(),
            [...small.validIndices],
            context
        )
    })

    bench("2000 points, tolerance 5", () => {
        toleranceInterpolation(
            large.values.slice(),
            large.times.slice(),
            [...large.validIndices],
            context
        )
    })
})

describe(computeRollingAverage, () => {
    const smallDense = makeDenseValues(120)
    const largeDense = makeDenseValues(2000)

    bench("120 points, window 7", () => {
        computeRollingAverage(smallDense, 7)
    })

    bench("2000 points, window 30", () => {
        computeRollingAverage(largeDense, 30)
    })
})
