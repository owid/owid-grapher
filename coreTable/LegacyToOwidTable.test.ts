#! /usr/bin/env yarn jest

import { DimensionProperty } from "grapher/core/GrapherConstants"
import { legacyToOwidTable } from "./LegacyToOwidTable"

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
