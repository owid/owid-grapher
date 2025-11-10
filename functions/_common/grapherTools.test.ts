import { expect, it, describe, DeeplyAllowMatchers } from "vitest"

import { getGrapherTableWithRelevantColumns } from "./grapherTools"
import {
    SampleColumnSlugs,
    SynthesizeGDPTable,
    OwidTable,
} from "@ourworldindata/core-table"
import { GrapherState } from "@ourworldindata/grapher"
import { ColumnTypeNames } from "@ourworldindata/types"

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

    it("doesn't duplicate time columns when multiple value columns have the same originalTime column", () => {
        // Create a table with multiple value columns that all share the same originalTime column
        const table = new OwidTable(
            {
                entityName: ["USA", "USA", "USA"],
                entityCode: ["US", "US", "US"],
                entityId: [1, 1, 1],
                year: [2020, 2020, 2020],
                day: [
                    "2020-01-01",
                    "2020-01-01",
                    "2020-01-01",
                ] as unknown as number[],
                flexitarian: [13, 13, 13],
                none: [3, 3, 3],
                vegan: [3, 3, 3],
                meat_eater: [72, 72, 72],
                pescetarian: [2, 2, 2],
                vegetarian: [6, 6, 6],
                // All value columns share the same originalTime column
                "flexitarian-originalTime": [2020, 2020, 2020],
                "none-originalTime": [2020, 2020, 2020],
                "vegan-originalTime": [2020, 2020, 2020],
                "meat_eater-originalTime": [2020, 2020, 2020],
                "pescetarian-originalTime": [2020, 2020, 2020],
                "vegetarian-originalTime": [2020, 2020, 2020],
            },
            [
                {
                    slug: "flexitarian",
                    type: ColumnTypeNames.Numeric,
                    name: "Flexitarian",
                },
                {
                    slug: "none",
                    type: ColumnTypeNames.Numeric,
                    name: "None",
                },
                {
                    slug: "vegan",
                    type: ColumnTypeNames.Numeric,
                    name: "Vegan",
                },
                {
                    slug: "meat_eater",
                    type: ColumnTypeNames.Numeric,
                    name: "Meat eater",
                },
                {
                    slug: "pescetarian",
                    type: ColumnTypeNames.Numeric,
                    name: "Pescetarian",
                },
                {
                    slug: "vegetarian",
                    type: ColumnTypeNames.Numeric,
                    name: "Vegetarian",
                },
                {
                    slug: "flexitarian-originalTime",
                    type: ColumnTypeNames.Year,
                    name: "Flexitarian originalTime",
                },
                {
                    slug: "none-originalTime",
                    type: ColumnTypeNames.Year,
                    name: "None originalTime",
                },
                {
                    slug: "vegan-originalTime",
                    type: ColumnTypeNames.Year,
                    name: "Vegan originalTime",
                },
                {
                    slug: "meat_eater-originalTime",
                    type: ColumnTypeNames.Year,
                    name: "Meat eater originalTime",
                },
                {
                    slug: "pescetarian-originalTime",
                    type: ColumnTypeNames.Year,
                    name: "Pescetarian originalTime",
                },
                {
                    slug: "vegetarian-originalTime",
                    type: ColumnTypeNames.Year,
                    name: "Vegetarian originalTime",
                },
            ]
        )

        const grapherState = new GrapherState({
            table,
            ySlugs: "flexitarian none vegan meat_eater pescetarian vegetarian",
        })

        const resultTable = getGrapherTableWithRelevantColumns(grapherState)
        const slugs = resultTable.columnSlugs

        // Count how many time-related columns are included
        const timeColumnCount = slugs.filter((slug) =>
            slug.includes("originalTime")
        ).length

        // There should be no duplicate time columns - all the originalTime columns
        // have the same values, so we should only include unique ones
        expect(timeColumnCount).toBeLessThanOrEqual(1)

        // Check that we don't have redundant time columns in the CSV output
        const csv = resultTable.toPrettyCsv(true)
        const headerLine = csv.split("\n")[0]
        const headers = headerLine.split(",")

        // Count occurrences of 'time' or 'day' in headers
        const timeHeaderCount = headers.filter(
            (h) => h === "time" || h === "day" || h.includes("originalTime")
        ).length

        // Should have at most one time column in the output
        expect(timeHeaderCount).toBeLessThanOrEqual(2) // day + one originalTime at most
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
