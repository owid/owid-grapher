import { expect, it, describe } from "vitest"
import { OwidTable } from "@ourworldindata/core-table"
import {
    ColumnTypeNames,
    DimensionProperty,
    type OwidColumnDef,
} from "@ourworldindata/types"
import { OwidVariableDisplayConfig } from "@ourworldindata/utils"
import { applyDimensionDisplayOverrides } from "./applyDimensionDisplay.js"

const csv = `entityName,year,rent_index,vacancy_rate,dwellings
Berlin,2015,100,3.1,1900000
Berlin,2020,131.4,1.2,1970000
Vienna,2015,100,4,940000
Vienna,2020,112.7,3.8,980000`

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
    {
        slug: "dwellings",
        type: ColumnTypeNames.Integer,
        name: "Dwellings",
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
        expect(column.displayName).toBe("Rents")
        expect(column.numDecimalPlaces).toBe(0)
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

    it("skips a slot without a slug", () => {
        const table = applyDimensionDisplayOverrides(makeTable(), [
            {
                property: DimensionProperty.y,
                variableId: 815383,
                display: { name: "Should not apply" },
            },
        ])

        expect(table.get("rent_index").displayName).toBe("Rent index")
    })

    it("scales the column's values by a conversion factor", () => {
        const table = applyDimensionDisplayOverrides(makeTable(), [
            {
                property: DimensionProperty.y,
                slug: "vacancy_rate",
                display: { conversionFactor: 100, unit: "per 10,000" },
            },
        ])

        const column = table.get("vacancy_rate")
        expect(column.values.slice(0, 2)).toEqual([310, 120])
        expect(column.unitConversionFactor).toBe(100)
        expect(table.get("rent_index").values[0]).toBe(100)
    })

    it("turns an integer column numeric when the factor isn't whole", () => {
        const table = applyDimensionDisplayOverrides(makeTable(), [
            {
                property: DimensionProperty.y,
                slug: "dwellings",
                display: { conversionFactor: 1e-6, unit: "millions" },
            },
        ])

        const column = table.get("dwellings")
        expect(column.def.type).toBe(ColumnTypeNames.Numeric)
        expect(column.values[0]).toBeCloseTo(1.9)
    })

    it("copies a slot's color onto the def, where column-coloured charts read it", () => {
        const table = applyDimensionDisplayOverrides(makeTable(), [
            {
                property: DimensionProperty.y,
                slug: "rent_index",
                display: { color: "#c15065" },
            },
        ])

        expect(table.get("rent_index").def.color).toBe("#c15065")
    })

    it("leaves the def alone where the slot's display is undefined", () => {
        const table = applyDimensionDisplayOverrides(makeTable(), [
            {
                property: DimensionProperty.y,
                slug: "rent_index",
                display: new OwidVariableDisplayConfig({ unit: "points" }),
            },
        ])

        const column = table.get("rent_index")
        expect(column.unit).toBe("points")
        expect(column.displayName).toBe("Rent index")
        expect(column.numDecimalPlaces).toBe(1)
    })

    it("takes the display of the first slot naming a column", () => {
        const table = applyDimensionDisplayOverrides(makeTable(), [
            {
                property: DimensionProperty.y,
                slug: "rent_index",
                display: { name: "Rents" },
            },
            {
                property: DimensionProperty.x,
                slug: "rent_index",
                display: { name: "Ignored", unit: "Ignored" },
            },
        ])

        const column = table.get("rent_index")
        expect(column.displayName).toBe("Rents")
        expect(column.unit).toBe("index (2015 = 100)")
    })

    it("doesn't copy an empty color onto the def", () => {
        const table = applyDimensionDisplayOverrides(makeTable(), [
            {
                property: DimensionProperty.y,
                slug: "rent_index",
                display: { color: "", name: "Rents" },
            },
        ])

        expect(table.get("rent_index").def.color).toBeUndefined()
    })
})
