#! /usr/bin/env yarn jest

import { ChartTypeName, DimensionProperty } from "grapher/core/GrapherConstants"
import { LegacyGrapherInterface } from "grapher/core/GrapherInterface"
import { ColumnTypeMap } from "./CoreTableColumns"
import { ErrorValueTypes } from "./ErrorValues"
import { legacyToOwidTableAndDimensions } from "./LegacyToOwidTable"
import { LegacyVariablesAndEntityKey } from "./LegacyVariableCode"
import { OwidTableSlugs, StandardOwidColumnDefs } from "./OwidTableConstants"

describe(legacyToOwidTableAndDimensions, () => {
    const legacyVariableConfig: LegacyVariablesAndEntityKey = {
        entityKey: { "1": { name: "World", code: "OWID_WRL", id: 1 } },
        variables: {
            "2": {
                id: 2,
                display: { conversionFactor: 100 },
                entities: [1],
                values: [8],
                years: [2020],
            },
        },
    }
    const legacyGrapherConfig: Partial<LegacyGrapherInterface> = {
        dimensions: [
            {
                variableId: 2,
                property: DimensionProperty.y,
            },
        ],
    }

    it("contains the standard entity columns", () => {
        const { table } = legacyToOwidTableAndDimensions(
            legacyVariableConfig,
            legacyGrapherConfig
        )
        expect(table.columnSlugs).toEqual(
            expect.arrayContaining(
                StandardOwidColumnDefs.map((def) => def.slug)
            )
        )
        expect(table.entityNameColumn.valuesIncludingErrorValues).toEqual([
            "World",
        ])
        expect(table.entityCodeColumn.valuesIncludingErrorValues).toEqual([
            "OWID_WRL",
        ])
    })

    describe("conversionFactor", () => {
        it("applies the more specific chart-level conversionFactor", () => {
            const { table } = legacyToOwidTableAndDimensions(
                legacyVariableConfig,
                {
                    dimensions: [
                        {
                            variableId: 2,
                            display: { conversionFactor: 10 },
                            property: DimensionProperty.y,
                        },
                    ],
                }
            )

            // Apply the chart-level conversionFactor (10)
            expect(table.rows[0]["2"]).toEqual(80)
        })

        it("applies the more variable-level conversionFactor if a chart-level one is not present", () => {
            const { table } = legacyToOwidTableAndDimensions(
                legacyVariableConfig,
                legacyGrapherConfig
            )

            // Apply the variable-level conversionFactor (100)
            expect(table.rows[0]["2"]).toEqual(800)
        })
    })

    describe("variables with years", () => {
        const legacyVariableConfig: LegacyVariablesAndEntityKey = {
            entityKey: {
                "1": { name: "World", code: "OWID_WRL", id: 1 },
                "2": { name: "High-income", code: null as any, id: 2 },
            },
            variables: {
                "2": {
                    id: 2,
                    entities: [1, 1, 1, 2],
                    values: [8, 9, 10, 11],
                    years: [2020, 2021, 2022, 2022],
                },
                "3": {
                    id: 3,
                    entities: [1, 2, 1],
                    values: [20, 21, 22],
                    years: [2022, 2022, 2024],
                },
            },
        }
        const legacyGrapherConfig: Partial<LegacyGrapherInterface> = {
            dimensions: [
                {
                    variableId: 2,
                    property: DimensionProperty.y,
                },
                {
                    variableId: 3,
                    property: DimensionProperty.y,
                },
            ],
        }

        const { table } = legacyToOwidTableAndDimensions(
            legacyVariableConfig,
            legacyGrapherConfig
        )

        it("leaves ErrorValues when there were no values to join to", () => {
            // Currently joins may just be partial and have many blank values. CoreTable will fill those in with the
            // appropriate ErrorValue type. It may make sense to change that and normalize keys in this method.
            const worldRows = table.rows.filter(
                (row) => row.entityName === "World"
            )
            expect(worldRows[0]["3"]).toEqual(
                ErrorValueTypes.NoMatchingValueAfterJoin
            )
            expect(worldRows[3]["2"]).toEqual(
                ErrorValueTypes.NoMatchingValueAfterJoin
            )
        })

        it("duplicates 'year' column into 'time'", () => {
            expect(table.columnSlugs).toEqual(
                expect.arrayContaining([
                    OwidTableSlugs.year,
                    OwidTableSlugs.time,
                ])
            )
            expect(
                table.get(OwidTableSlugs.time) instanceof ColumnTypeMap.Year
            ).toBeTruthy()
            expect(table.columnSlugs).not.toContain(OwidTableSlugs.day)
            expect(table.get(OwidTableSlugs.time).valuesAscending).toEqual([
                2020,
                2021,
                2022,
                2022,
                2024,
            ])
        })

        it("handles `null` in country codes", () => {
            const highIncomeRows = table.rows.filter(
                (row) => row.entityName === "High-income"
            )
            expect(table.rows.length).toEqual(5)
            expect(highIncomeRows.length).toEqual(1)
        })
    })

    describe("variables with days", () => {
        const legacyVariableConfig: LegacyVariablesAndEntityKey = {
            entityKey: { "1": { name: "World", code: "OWID_WRL", id: 1 } },
            variables: {
                "2": {
                    id: 2,
                    entities: [1, 1, 1],
                    values: [8, 9, 10],
                    years: [-5, 0, 1],
                    display: {
                        yearIsDay: true,
                        zeroDay: "2020-01-21",
                    },
                },
                "3": {
                    id: 3,
                    entities: [1, 1],
                    values: [20, 21],
                    years: [-4, -3],
                    display: {
                        yearIsDay: true,
                        zeroDay: "2020-01-19",
                    },
                },
            },
        }
        const legacyGrapherConfig = {
            dimensions: [
                {
                    variableId: 2,
                    property: DimensionProperty.y,
                },
                {
                    variableId: 3,
                    property: DimensionProperty.y,
                },
            ],
        }

        const { table } = legacyToOwidTableAndDimensions(
            legacyVariableConfig,
            legacyGrapherConfig
        )

        it("shifts values in days array when zeroDay is is not EPOCH_DATE", () => {
            expect(table.get("2").uniqTimesAsc).toEqual([-5, 0, 1])
            expect(table.get("3").uniqTimesAsc).toEqual([-6, -5])
        })

        it("duplicates 'day' column into 'time'", () => {
            expect(table.columnSlugs).toEqual(
                expect.arrayContaining([
                    OwidTableSlugs.day,
                    OwidTableSlugs.time,
                ])
            )
            expect(
                table.get(OwidTableSlugs.time) instanceof ColumnTypeMap.Day
            ).toBeTruthy()
            expect(table.columnSlugs).not.toContain(OwidTableSlugs.year)
            expect(table.get(OwidTableSlugs.time).valuesAscending).toEqual([
                -6,
                -5,
                0,
                1,
            ])
        })
    })

    describe("variables with mixed days & years", () => {
        const legacyVariableConfig: LegacyVariablesAndEntityKey = {
            entityKey: { "1": { name: "World", code: "OWID_WRL", id: 1 } },
            variables: {
                "2": {
                    id: 2,
                    entities: [1, 1, 1],
                    values: [8, 9, 10],
                    years: [-5, 0, 1],
                    display: {
                        yearIsDay: true,
                        zeroDay: "2020-01-21",
                    },
                },
                "3": {
                    id: 3,
                    entities: [1, 1],
                    values: [20, 21],
                    years: [2020, 2021],
                },
            },
        }
        const legacyGrapherConfig: Partial<LegacyGrapherInterface> = {
            dimensions: [
                {
                    variableId: 2,
                    property: DimensionProperty.y,
                },
                {
                    variableId: 3,
                    property: DimensionProperty.y,
                    targetYear: 2022,
                    display: {
                        tolerance: 1,
                    },
                },
            ],
        }

        const { table } = legacyToOwidTableAndDimensions(
            legacyVariableConfig,
            legacyGrapherConfig
        )

        it("duplicates 'day' column into 'time'", () => {
            expect(table.columnSlugs).toEqual(
                expect.arrayContaining([
                    OwidTableSlugs.day,
                    OwidTableSlugs.time,
                ])
            )
            expect(
                table.get(OwidTableSlugs.time) instanceof ColumnTypeMap.Day
            ).toBeTruthy()
            expect(table.get(OwidTableSlugs.time).uniqValues).toEqual([
                -5,
                0,
                1,
            ])
        })

        describe("scatter-specific behavior", () => {
            it("only joins targetTime on Scatters", () => {
                expect(table.rows.length).toEqual(4)
            })

            it("joins targetTime", () => {
                const scatterLegacyGrapherConfig = {
                    ...legacyGrapherConfig,
                    type: ChartTypeName.ScatterPlot,
                }

                const { table } = legacyToOwidTableAndDimensions(
                    legacyVariableConfig,
                    scatterLegacyGrapherConfig
                )

                expect(table.rows.length).toEqual(3)
                expect(table.columnSlugs.includes("3-2020")).toBeTruthy()
                const column = table.get("3-2020")
                expect(column.valuesIncludingErrorValues).toEqual([21, 21, 21])
                expect(column.originalTimes).toEqual([2021, 2021, 2021])
            })
        })
    })
})
