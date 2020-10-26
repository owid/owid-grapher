#! /usr/bin/env yarn jest

import { DimensionProperty } from "grapher/core/GrapherConstants"
import {
    legacyToOwidTable,
    legacyVariablesToColDefsAndOwidRowsSortedByTimeAsc,
} from "./LegacyToOwidTable"

describe(legacyToOwidTable, () => {
    const legacyVariableConfig = {
        entityKey: { "1": { name: "Rail", code: "RAL", id: 1 } },
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

    it("applies the more specific chart-level conversionFactor", () => {
        const table = legacyToOwidTable(legacyVariableConfig, {
            dimensions: [
                {
                    variableId: 2,
                    display: { conversionFactor: 10 },
                    property: DimensionProperty.y,
                },
            ],
        })

        // Apply the chart-level conversionFactor (10)
        expect(table.rows[0]["2"]).toEqual(80)
    })

    it("applies the more variable-level conversionFactor if a chart-level one is not present", () => {
        const table = legacyToOwidTable(legacyVariableConfig)

        // Apply the variable-level conversionFactor (100)
        expect(table.rows[0]["2"]).toEqual(800)
    })
})

describe(legacyVariablesToColDefsAndOwidRowsSortedByTimeAsc, () => {
    it("generated rows may have different keys initially", () => {
        // Currently joins may just be partial and have many blank values. CoreTable will fill those in with the
        // appropriate invalid type. It may make sense to change that and normalize keys in this method.
        const legacyVariableConfig = {
            entityKey: { "1": { name: "Rail", code: "RAL", id: 1 } },
            variables: {
                "2": {
                    id: 2,
                    entities: [1, 1, 1],
                    values: [8, 9, 10],
                    years: [2020, 2021, 2022],
                },
                "3": {
                    id: 3,
                    entities: [1],
                    values: [20],
                    years: [2022],
                },
            },
        }

        const table = legacyVariablesToColDefsAndOwidRowsSortedByTimeAsc(
            legacyVariableConfig
        )

        expect(Object.keys(table.rows[0]).includes("3")).toBeTruthy()
        expect(table.rows[0]["3"]).toBeUndefined()
    })
})
