import { expect, it, describe } from "vitest"
import { isNotErrorValue, OwidTable } from "@ourworldindata/core-table"
import {
    ColumnTypeNames,
    DimensionProperty,
    type OwidColumnDef,
} from "@ourworldindata/types"
import { applyDimensionDisplayAndConversionFactor } from "./applyDisplayAndConversionFactor.js"

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

describe(applyDimensionDisplayAndConversionFactor, () => {
    it("lays a slot's display over the column's own definition", () => {
        const table = applyDimensionDisplayAndConversionFactor(makeTable(), [
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
        const table = applyDimensionDisplayAndConversionFactor(makeTable(), [
            {
                property: DimensionProperty.y,
                slug: "rent_index",
                display: { name: "Rents" },
            },
        ])

        expect(table.get("vacancy_rate").displayName).toBe("Vacancy rate")
    })

    it("returns the same table when no slot carries a display", () => {
        const table = makeTable()
        expect(applyDimensionDisplayAndConversionFactor(table, [])).toBe(table)
        expect(
            applyDimensionDisplayAndConversionFactor(table, [
                { property: DimensionProperty.y, slug: "rent_index" },
            ])
        ).toBe(table)
    })

    it("ignores a slot naming a column the table doesn't have", () => {
        const table = makeTable()
        expect(
            applyDimensionDisplayAndConversionFactor(table, [
                {
                    property: DimensionProperty.y,
                    slug: "not_a_column",
                    display: { name: "Nope" },
                },
            ])
        ).toBe(table)
    })

    it("leaves indicator columns to the indicator pipeline", () => {
        const table = applyDimensionDisplayAndConversionFactor(
            new OwidTable(
                [
                    ["entityName", "year", "815383"],
                    ["Berlin", 2020, 8],
                ],
                [{ slug: "815383", type: ColumnTypeNames.Numeric, name: "GDP" }]
            ),
            [
                {
                    property: DimensionProperty.y,
                    variableId: 815383,
                    display: { conversionFactor: 10, name: "Scaled twice" },
                },
            ]
        )

        const column = table.get("815383")
        expect(column.values).toEqual([8])
        expect(column.displayName).toBe("GDP")
    })

    it("scales the column's values by a conversion factor", () => {
        const table = applyDimensionDisplayAndConversionFactor(makeTable(), [
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

    it("leaves missing values missing when scaling", () => {
        const table = applyDimensionDisplayAndConversionFactor(
            new OwidTable(
                `entityName,year,vacancy_rate
Berlin,2020,1.2
Vienna,2020,`,
                columnDefs
            ),
            [
                {
                    property: DimensionProperty.y,
                    slug: "vacancy_rate",
                    display: { conversionFactor: 100 },
                },
            ]
        )

        const [berlin, vienna] =
            table.get("vacancy_rate").valuesIncludingErrorValues
        expect(berlin).toBe(120)
        expect(isNotErrorValue(vienna)).toBe(false)
    })

    it("turns an integer column numeric when the factor isn't whole", () => {
        const table = applyDimensionDisplayAndConversionFactor(makeTable(), [
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

    it("keeps an integer column integer when the factor is whole", () => {
        const table = applyDimensionDisplayAndConversionFactor(makeTable(), [
            {
                property: DimensionProperty.y,
                slug: "dwellings",
                display: { conversionFactor: 1000 },
            },
        ])

        const column = table.get("dwellings")
        expect(column.def.type).toBe(ColumnTypeNames.Integer)
        expect(column.values[0]).toBe(1_900_000_000)
    })

    it("copies a slot's color onto the def, where column-coloured charts read it", () => {
        const table = applyDimensionDisplayAndConversionFactor(makeTable(), [
            {
                property: DimensionProperty.y,
                slug: "rent_index",
                display: { color: "#c15065" },
            },
        ])

        expect(table.get("rent_index").def.color).toBe("#c15065")
    })

    it("keeps the column's own value where the slot leaves a field undefined", () => {
        const table = applyDimensionDisplayAndConversionFactor(makeTable(), [
            {
                property: DimensionProperty.y,
                slug: "rent_index",
                display: {
                    unit: "points",
                    name: undefined,
                    numDecimalPlaces: undefined,
                },
            },
        ])

        const column = table.get("rent_index")
        expect(column.unit).toBe("points")
        expect(column.displayName).toBe("Rent index")
        expect(column.numDecimalPlaces).toBe(1)
    })

    it("takes the display of the first slot naming a column", () => {
        const table = applyDimensionDisplayAndConversionFactor(makeTable(), [
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
        const table = applyDimensionDisplayAndConversionFactor(makeTable(), [
            {
                property: DimensionProperty.y,
                slug: "rent_index",
                display: { color: "", name: "Rents" },
            },
        ])

        expect(table.get("rent_index").def.color).toBeUndefined()
    })
})
