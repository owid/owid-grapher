import { bench, describe } from "vitest"
import {
    SampleColumnSlugs,
    SynthesizeGDPTable,
} from "@ourworldindata/core-table"
import { LineChartState } from "./LineChartState.js"
import { LineChartManager } from "./LineChartConstants.js"

// End-to-end chart-state pipeline for the line chart: filter/clean the input
// table (`transformTable`) and turn it into the logical `series` (one line per
// entity × y-column, each with a point per year). This is the work that runs
// between "config + data" and "ready to lay out and draw", and it is redone
// whenever the selection or the underlying table changes.
//
// The state memoizes its computed getters, so every benchmark constructs a
// *fresh* state per iteration — otherwise we'd measure a cached value. The
// input table is built once (fixed seed) and its column store is materialized
// up front so we don't fold parse cost into the transform measurement.

const SEED = 1

/** Reference a value so it isn't flagged as an unused expression (and assert the materialization actually produced data). */
function keep(value: unknown): void {
    if (value === undefined) throw new Error("expected a value")
}

function makeManager(entityCount: number): LineChartManager {
    const table = SynthesizeGDPTable(
        { entityCount, timeRange: [1900, 2020] },
        SEED
    )
    keep(table.get(SampleColumnSlugs.GDP).values) // materialize the base table
    return {
        table,
        yColumnSlugs: [SampleColumnSlugs.GDP],
        selection: table.availableEntityNames,
    }
}

describe("LineChartState.transformTable", () => {
    const manager = makeManager(200)

    bench("200 entities × 120 years", () => {
        const state = new LineChartState({ manager })
        keep(state.transformedTable.get(SampleColumnSlugs.GDP).values)
    })
})

describe("LineChartState.series", () => {
    const smallManager = makeManager(50)
    const largeManager = makeManager(200)

    bench("50 entities", () => {
        const state = new LineChartState({ manager: smallManager })
        keep(state.series)
    })

    bench("200 entities", () => {
        const state = new LineChartState({ manager: largeManager })
        keep(state.series)
    })
})
