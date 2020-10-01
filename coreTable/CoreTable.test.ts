#! /usr/bin/env yarn jest

import { AnyTable } from "./CoreTable"
import { ColumnTypeNames } from "./CoreTableConstants"

const sampleCsv = `country,population
iceland,1
france,50
usa,300
canada,20`

it("a table can be made from csv", () => {
    const table = AnyTable.fromDelimited(sampleCsv)
    expect(table.rows.length).toEqual(4)
    expect(Array.from(table.columnsByName.keys())).toEqual([
        "country",
        "population",
    ])
})

it("input rows are never mutated", () => {
    const rows = [{ country: "USA" }, { country: "Germany" }]
    const table = new AnyTable(rows, [
        {
            slug: "firstLetter",
            fn: (row) => row.country.length,
        },
    ])
    expect(table.get("firstLetter")?.parsedValues.join("")).toEqual(`37`)
    expect((rows[0] as any).firstLetter).toEqual(undefined)
})

it("can drop columns", () => {
    const rows = [
        { country: "USA", year: 1999 },
        { country: "Germany", year: 2000 },
    ]
    const table = new AnyTable(rows)
    expect(table.columnSlugs).toEqual(["country", "year"])
    expect(table.withoutColumns(["year"]).columnSlugs).toEqual(["country"])
})

describe("filtering", () => {
    const rootTable = AnyTable.fromDelimited(sampleCsv)
    const filteredTable = rootTable.filterBy(
        (row) => parseInt(row.population) > 40,
        "Pop filter"
    )
    it("one filter works", () => {
        expect(rootTable.get("country")!.parsedValues[3]).toEqual("canada")
        const parsedValues = filteredTable.get("country")!.parsedValues
        expect(parsedValues[0]).toEqual("france")
        expect(parsedValues[1]).toEqual("usa")
    })

    it("multiple filters work", () => {
        const filteredTwiceTable = filteredTable.filterBy(
            (row) => (row.country as string).startsWith("u"),
            "Letter filter"
        )
        const parsedValues = filteredTwiceTable.get("country")!.parsedValues
        expect(parsedValues[0]).toEqual("usa")
        expect(parsedValues[1]).toEqual(undefined)
    })
})

it("uses slugs for headers in toDelimited", () => {
    const table = AnyTable.fromDelimited(`country,Population in 2020
iceland,1`)
    const csv = table.toDelimited()
    expect(csv).toEqual(`country,Population-in-2020
iceland,1`)
    expect(table.get("country")!.isEmpty).toBe(false)
})

it("can export a clean csv with dates", () => {
    const table = new AnyTable(
        [
            { entityName: "Aruba", day: 1, annotation: "Something, foo" },
            { entityName: "Canada", day: 2 },
        ],
        [
            { slug: "entityName" },
            { slug: "day", type: "Date" as any },
            { slug: "annotation" },
        ]
    )

    expect(table.constantColumns().length).toEqual(0)
    expect(table.toCsvWithColumnNames()).toEqual(`entityName,day,annotation
Aruba,2020-01-22,"Something, foo"
Canada,2020-01-23,`)
})

it("can detect all integers", () => {
    const table = AnyTable.fromDelimited(`gdp,perCapita
123,123.1`)
    expect(table.get("gdp")?.isAllIntegers).toBeTruthy()
    expect(table.get("perCapita")?.isAllIntegers).toBeFalsy()
})

it("can format a value", () => {
    const table = AnyTable.fromDelimited(
        `growthRate
123`,
        [
            {
                slug: "growthRate",
                display: { unit: "%" },
                type: ColumnTypeNames.Numeric,
            },
        ]
    )
    expect(table.get("growthRate")?.formatValueShort(20)).toEqual("20%")
})

it("can get the domain across all columns", () => {
    const table = AnyTable.fromDelimited(
        `gdp,perCapita
0,123.1
12,300
20,40`,
        [
            { slug: "gdp", type: ColumnTypeNames.Numeric },
            { slug: "perCapita", type: ColumnTypeNames.Numeric },
        ]
    )
    const domainFor = table.domainFor(["gdp", "perCapita"])
    expect(domainFor).toEqual([0, 300])
})

it("can get annotations for a row", () => {
    const csv = `entityName,pop,notes,year
usa,322,in hundreds of millions,2000
hi,1,in millions,2000
hi,1,,2001`
    const table = AnyTable.fromDelimited(csv)

    const annotationsColumn = table.get("notes")
    const entityNameMap = annotationsColumn!.entityNameMap

    expect(entityNameMap.size).toEqual(2)
    expect(entityNameMap.get("hi")).toContain("in millions")
    expect(entityNameMap.get("usa")).toContain("in hundreds of millions")
})
