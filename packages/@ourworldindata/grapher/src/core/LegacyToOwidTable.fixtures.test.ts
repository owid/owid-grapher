import { describe, expect, it, vi } from "vitest"
import { legacyToOwidTableAndDimensions } from "./LegacyToOwidTable"
import {
    benchmarkFixtures,
    edgeCaseFixtures,
} from "./LegacyToOwidTable.fixtures"

// The joined table can share arrays with the fetched data, so building it must
// never write into its input, and every column must cover every row
describe.each([...edgeCaseFixtures, ...benchmarkFixtures])(
    "$name",
    (fixture) => {
        it("leaves the input untouched and fills every column", () => {
            // Some fixtures have duplicate rows, which log a debugging hint
            vi.spyOn(console, "error").mockImplementation(() => undefined)
            const json = fixture.json()
            const table = legacyToOwidTableAndDimensions(
                json,
                fixture.dimensions,
                fixture.selectedEntityColors
            )

            expect(json).toEqual(fixture.json())
            for (const slug of table.columnSlugs)
                expect(
                    table.get(slug).valuesIncludingErrorValues,
                    slug
                ).toHaveLength(table.numRows)
            vi.restoreAllMocks()
        })
    }
)
