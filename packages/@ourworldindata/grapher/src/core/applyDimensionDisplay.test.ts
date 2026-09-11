import { expect, it, describe } from "vitest"
import { OwidTable } from "@ourworldindata/core-table"
import {
    ColumnTypeNames,
    DimensionProperty,
    type OwidColumnDef,
} from "@ourworldindata/types"
import { applyDimensionDisplayOverrides } from "./applyDimensionDisplay.js"

const csv = `entityName,year,rent_index,vacancy_rate
Berlin,2015,100,3.1
Berlin,2020,131.4,1.2
Vienna,2015,100,4
Vienna,2020,112.7,3.8`

const columnDefs: OwidColumnDef[] = [
    {
        slug: "rent_index",
        type: ColumnTypeNames.Numeric,
        name: "Rent index",
        unit: "index (2015 = 100)",
        display: { numDecimalPlaces: 1 },
    },
    {
        slug: "vacancy_rate",
        type: ColumnTypeNames.Numeric,
        name: "Vacancy rate",
    },
]

const makeTable = (): OwidTable => new OwidTable(csv, columnDefs)

describe(applyDimensionDisplayOverrides, () => {
    it("lays a slot's display over the column's own definition", () => {
        const table = applyDimensionDisplayOverrides(makeTable(), [
            {
                property: DimensionProperty.y,
                slug: "rent_index",
                display: { name: "Rents", numDecimalPlaces: 0 },
            },
        ])

        const column = table.get("rent_index")
        // The chart's name and rounding win...
        expect(column.displayName).toBe("Rents")
        expect(column.numDecimalPlaces).toBe(0)
        // ...and what the chart says nothing about is left alone.
        expect(column.unit).toBe("index (2015 = 100)")
    })

    it("leaves columns no slot points at untouched", () => {
        const table = applyDimensionDisplayOverrides(makeTable(), [
            {
                property: DimensionProperty.y,
                slug: "rent_index",
                display: { name: "Rents" },
            },
        ])

        expect(table.get("vacancy_rate").displayName).toBe("Vacancy rate")
    })

    it("returns the same table when no slot overrides anything", () => {
        const table = makeTable()
        expect(applyDimensionDisplayOverrides(table, undefined)).toBe(table)
        expect(
            applyDimensionDisplayOverrides(table, [
                { property: DimensionProperty.y, slug: "rent_index" },
                { property: DimensionProperty.y, variableId: 42 },
                {
                    property: DimensionProperty.y,
                    slug: "not_a_column",
                    display: { name: "Nope" },
                },
            ])
        ).toBe(table)
    })

    it("ignores indicator-backed slots, whose display is folded in on assembly", () => {
        const table = applyDimensionDisplayOverrides(makeTable(), [
            {
                property: DimensionProperty.y,
                variableId: 815383,
                display: { name: "Should not apply" },
            },
        ])

        expect(table.get("rent_index").displayName).toBe("Rent index")
    })
})
