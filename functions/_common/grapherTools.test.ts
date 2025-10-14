import { expect, it, describe, DeeplyAllowMatchers } from "vitest"

import { getGrapherTableWithRelevantColumns } from "./grapherTools"
import {
    SampleColumnSlugs,
    SynthesizeGDPTable,
} from "@ourworldindata/core-table"
import { GrapherState } from "@ourworldindata/grapher"

describe(getGrapherTableWithRelevantColumns, () => {
    const originalTable = SynthesizeGDPTable()
    const originalYColumns: string[] = [
        SampleColumnSlugs.GDP,
        SampleColumnSlugs.Population,
        SampleColumnSlugs.LifeExpectancy,
    ]
    const originalOtherColumns = originalTable.columnSlugs.filter(
        (slug) => !originalYColumns.includes(slug)
    )

    it("doesn't include any y-columns when none are specified", () => {
        const grapherState = new GrapherState({ table: SynthesizeGDPTable() })
        const resultTable = getGrapherTableWithRelevantColumns(grapherState)
        const slugs = resultTable.columnSlugs
        expect(slugs).toEqual(
            originalTable.columnSlugs.filter(
                (slug) => !originalYColumns.includes(slug)
            )
        )
    })

    it("only includes the chart's y-columns", () => {
        const ySlugCombinations = [
            SampleColumnSlugs.GDP,
            `${SampleColumnSlugs.GDP} ${SampleColumnSlugs.LifeExpectancy}`,
            `${SampleColumnSlugs.Population} ${SampleColumnSlugs.LifeExpectancy}`,
            `${SampleColumnSlugs.GDP} ${SampleColumnSlugs.LifeExpectancy} ${SampleColumnSlugs.Population}`,
        ]

        for (const ySlugs of ySlugCombinations) {
            const grapherState = new GrapherState({
                table: SynthesizeGDPTable(),
                ySlugs,
            })
            const resultTable = getGrapherTableWithRelevantColumns(grapherState)
            const slugs = resultTable.columnSlugs
            expectUnorderedEqual(slugs, [
                ...originalOtherColumns,
                ...ySlugs.split(" "),
            ])
        }
    })
})

/**
 * Helper function to assert that an array contains exactly the expected elements
 * (no more, no less, but order doesn't matter)
 */
function expectUnorderedEqual<T>(
    actual: T[],
    expected: DeeplyAllowMatchers<T>[]
) {
    expect(actual).toEqual(expect.arrayContaining(expected))
    expect(actual).toHaveLength(expected.length)
}
