import { bench, describe } from "vitest"
import {
    SampleColumnSlugs,
    SynthesizeGDPTable,
} from "@ourworldindata/core-table"
import { ScatterPlotChartState } from "./ScatterPlotChartState.js"
import { ScatterPlotManager } from "./ScatterPlotChartConstants.js"

// The scatter plot has the heaviest table-transform pipeline of the common
// chart types: `transformTable` chains dropping/filtering with a
// closest-time-match interpolation between the X and Y columns, then
// `allPoints` builds a rich point object per row (reading x, y, size, color and
// their original-time columns) and `series` groups those points by entity.
//
// State getters are memoized, so each benchmark builds a fresh state per
// iteration. The input table is materialized once up front.

const SEED = 1

/** Reference a value so it isn't flagged as an unused expression (and assert the materialization actually produced data). */
function keep(value: unknown): void {
    if (value === undefined) throw new Error("expected a value")
}

function makeManager(entityCount: number): ScatterPlotManager {
    const table = SynthesizeGDPTable(
        { entityCount, timeRange: [1950, 2020] },
        SEED
    )
    keep(table.get(SampleColumnSlugs.GDP).values) // materialize the base table
    return {
        table,
        xColumnSlug: SampleColumnSlugs.GDP,
        yColumnSlug: SampleColumnSlugs.LifeExpectancy,
        sizeColumnSlug: SampleColumnSlugs.Population,
        selection: table.availableEntityNames,
    }
}

describe("ScatterPlotChartState.allPoints", () => {
    const smallManager = makeManager(50)
    const largeManager = makeManager(200)

    bench("50 entities × 70 years", () => {
        const state = new ScatterPlotChartState({ manager: smallManager })
        keep(state.allPoints)
    })

    bench("200 entities × 70 years", () => {
        const state = new ScatterPlotChartState({ manager: largeManager })
        keep(state.allPoints)
    })
})

describe("ScatterPlotChartState.series", () => {
    const manager = makeManager(200)

    bench("200 entities × 70 years", () => {
        const state = new ScatterPlotChartState({ manager })
        keep(state.series)
    })
})
