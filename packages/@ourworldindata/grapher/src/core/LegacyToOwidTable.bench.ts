// Benchmarks for building a chart's table from fetched variable data.
// Run with `yarn testBenchmarks LegacyToOwidTable`; `yarn test` skips them.
//
// Times include Vite's module-runner overhead, which bundled code doesn't have,
// so compare runs against each other (e.g. this branch vs master on the same
// machine) rather than reading them as production timings.

import { test, vi } from "vitest"
import { legacyToOwidTableAndDimensions } from "./LegacyToOwidTable"
import { benchmarkFixtures } from "./LegacyToOwidTable.fixtures"

for (const fixture of benchmarkFixtures) {
    test(fixture.name, async ({ bench, onTestFinished }) => {
        // Duplicate rows log a debugging hint, which would be timed as well
        vi.spyOn(console, "error").mockImplementation(() => undefined)
        onTestFinished(() => {
            vi.restoreAllMocks()
        })

        // Build the input once, outside the measured function
        const json = fixture.json()
        await bench(fixture.name, () => {
            const table = legacyToOwidTableAndDimensions(
                json,
                fixture.dimensions,
                fixture.selectedEntityColors
            )
            // OwidTable computes lazily, so make it build what charts read
            // first
            void table.columnStore
            void table.numRows
            void table.timeColumn.valuesIncludingErrorValues
        }).run()
    })
}
