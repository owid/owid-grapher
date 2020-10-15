#! /usr/bin/env yarn jest

import { rowsFromGrid } from "grapher/utils/Util"
import { CoreTable } from "./CoreTable"
import { ColumnTypeNames } from "./CoreTableConstants"

const sampleCsv = `country,population
iceland,1
france,50
usa,300
canada,20`

it("a table can be made from csv", () => {
    const table = CoreTable.fromDelimited(sampleCsv)
    expect(table.numRows).toEqual(4)
    expect(table.columnNames).toEqual(["country", "population"])
})

it("rows can be added without mutating the parent table", () => {
    const table = CoreTable.fromDelimited(sampleCsv)
    expect(table.numRows).toEqual(4)

    let expandedTable = table.withRows(
        [{ country: "Japan", population: 123 }],
        `Added 1 row`
    )
    expect(expandedTable.numRows).toBe(5)
    expect(table.numRows).toEqual(4)

    expandedTable = expandedTable
        .withRenamedColumns({ population: "pop" })
        .withRows(
            [{ country: "USA", pop: 321 }],
            "Added a row after column renaming"
        )
    expect(expandedTable.numRows).toEqual(6)
    expect(expandedTable.rows[5].pop).toEqual(321)
})

describe("explain", () => {
    const table = CoreTable.fromDelimited(sampleCsv).withoutColumns([
        "population",
    ])
    it("transforms have an index", () => {
        expect(table.stepNumber).toEqual(1)
    })

    it("explain short has a row for each transform", () => {
        expect(table.explainShort().split("\n").length).toEqual(3)
    })

    it("explain long contains useful info like Javscript types and perf info", () => {
        expect(table.explain()).toContain("jsType")
        expect(table.explain()).toContain("ms")
    })
})

describe("it can add new computed columns", () => {
    it("input rows are never mutated", () => {
        const rows = [{ country: "USA" }, { country: "Germany" }]
        const table = new CoreTable(rows, [
            {
                slug: "firstLetter",
                fn: (row) => row.country.length,
            },
        ])
        expect(table.get("firstLetter")?.parsedValues.join("")).toEqual(`37`)
        expect((rows[0] as any).firstLetter).toEqual(undefined)
    })

    it("computations are only run once", () => {
        const rows = [{ country: "USA" }]
        let count = 0
        let table = new CoreTable(rows, [
            {
                slug: "count",
                fn: (row) => ++count,
            },
        ])
        let firstRow = table.firstRow as any
        expect(firstRow.count).toEqual(1)
        table = table.withTransformedDefs((def) => def)
        firstRow = table.firstRow as any
        expect(firstRow.count).toEqual(1)
    })
})

it("can drop columns", () => {
    const rows = [
        { country: "USA", year: 1999 },
        { country: "Germany", year: 2000 },
    ]
    const table = new CoreTable(rows)
    expect(table.columnSlugs).toEqual(["country", "year"])
    expect(table.withoutColumns(["year"]).columnSlugs).toEqual(["country"])
})

it("can transform columns", () => {
    const rows = [
        { country: "USA", year: 1999 },
        { country: "Germany", year: 2000 },
    ]
    const table = new CoreTable(rows)
    expect(table.columnNames).toEqual(["country", "Year"])
    expect(
        table.withTransformedDefs((def) => {
            return {
                ...def,
                name: def.slug.toUpperCase(),
            }
        }).columnNames
    ).toEqual(["COUNTRY", "YEAR"])
})

it("can sort columns", () => {
    const rows = [
        { country: "USA", year: 1999 },
        { country: "Germany", year: 2000 },
    ]
    const table = new CoreTable(rows)
    expect(table.columnSlugs).toEqual(["country", "year"])
    expect(table.sortColumns(["year", "country"]).columnSlugs).toEqual([
        "year",
        "country",
    ])
})

describe("searching", () => {
    const rows = [
        { country: "USA", year: 1999 },
        { country: "Germany", year: 2000 },
        { country: "Germany", year: 2001 },
    ]
    const table = new CoreTable(rows)

    it("can filter by exact matches to certain columns", () => {
        expect(table.where({ country: "Germany" }).numRows).toEqual(2)
        expect(table.findRows({ country: "Germany" }).length).toEqual(2)
        expect(table.where({ country: "Germany", year: 2001 }).numRows).toEqual(
            1
        )
        expect(table.where({}).numRows).toEqual(3)
        expect(table.where({ country: ["Germany", "USA"] }).numRows).toEqual(3)
        expect(table.where({ year: [2002] }).numRows).toEqual(0)
        expect(
            table.where({ year: [1999], country: "Germany" }).numRows
        ).toEqual(0)
    })

    it("can just do simple grep like searching to find rows", () => {
        expect(table.grep("Germany").numRows).toEqual(2)
        expect(table.grep("USA").numRows).toEqual(1)
        expect(table.grep("USA").numRows).toEqual(1)
        expect(table.grep("Missing").numRows).toEqual(0)
        expect(table.grep("200").numRows).toEqual(2)
        expect(table.grep(/20\d+/).numRows).toEqual(2)

        expect(table.grep("Germany").grepNot("2001").numRows).toEqual(1)
        expect(table.grep(/(1999|2000)/).numRows).toEqual(2)
    })

    it("can filter columns as well", () => {
        expect(table.grepColumns("country").numColumns).toEqual(1)
        expect(table.grepColumns("r").numColumns).toEqual(2)
        expect(table.grepColumns("zz").numColumns).toEqual(0)
        expect(table.grepColumnsNot("year").numColumns).toEqual(1)
        expect(table.grepColumnsNot(/co.+/).numColumns).toEqual(1)
    })
})

describe("filtering", () => {
    const rootTable = CoreTable.fromDelimited(sampleCsv)
    const filteredTable = rootTable.filter(
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
        const filteredTwiceTable = filteredTable.filter(
            (row: any) => (row.country as string).startsWith("u"),
            "Letter filter"
        )
        const parsedValues = filteredTwiceTable.get("country")!.parsedValues
        expect(parsedValues[0]).toEqual("usa")
        expect(parsedValues[1]).toEqual(undefined)
    })
})

it("uses slugs for headers in toDelimited", () => {
    const table = CoreTable.fromDelimited(`country,Population in 2020
iceland,1`)
    const csv = table.toDelimited()
    expect(csv).toEqual(`country,Population-in-2020
iceland,1`)
    expect(table.get("country")!.isEmpty).toBe(false)
})

it("can export a clean csv with dates", () => {
    const table = new CoreTable(
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
    const table = CoreTable.fromDelimited(`gdp,perCapita
123,123.1`)
    expect(table.get("gdp")?.isAllIntegers).toBeTruthy()
    expect(table.get("perCapita")?.isAllIntegers).toBeFalsy()
})

it("can format a value", () => {
    const table = CoreTable.fromDelimited(
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
    const table = CoreTable.fromDelimited(
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
    const table = CoreTable.fromDelimited(csv)

    const annotationsColumn = table.get("notes")
    const entityNameMap = annotationsColumn!.getUniqueValuesGroupedBy(
        "entityName"
    )

    expect(entityNameMap.size).toEqual(2)
    expect(entityNameMap.get("hi")).toContain("in millions")
    expect(entityNameMap.get("usa")).toContain("in hundreds of millions")
})

it("can get all defined values for a column", () => {
    const table = new CoreTable(
        [
            { pop: undefined, year: 1999 },
            { pop: 123, year: 2000 },
        ],
        [{ type: ColumnTypeNames.Numeric, slug: "pop" }]
    )
    expect(table.get("pop")?.numValues).toEqual(1)
    expect(table.get("pop")?.numParseErrors).toEqual(1)
    expect(table.numColumnsWithParseErrors).toEqual(1)
})

it("can rename a column", () => {
    let table = new CoreTable([{ pop: 123, year: 2000 }])
    table = table.withRenamedColumns({ pop: "Population" })
    expect(table.columnSlugs).toEqual(["Population", "year"])
    const firstRow = table.firstRow as any
    expect(firstRow.Population).toEqual(123)
})

it("can tranpose a table", () => {
    let table = new CoreTable([
        { fruit: 123, veggies: 234, entity: "usa" },
        { fruit: 456, veggies: 789, entity: "canada" },
        { fruit: 333, veggies: 222, entity: "spain" },
    ])
    table = table.transpose("entity")
    expect(table.columnSlugs).toEqual(["entity", "usa", "canada", "spain"])
    expect(table.numRows).toEqual(2)
    const firstRow = table.firstRow as any
    expect(firstRow.canada).toEqual(456)
})

it("can replace cells for log scale", () => {
    let table = new CoreTable([
        { pop: -20, gdp: 100, births: -4 },
        { pop: 0, gdp: -2, births: 20 },
    ])
    expect(table.get("pop")?.numValues).toEqual(2)
    expect(table.get("gdp")?.numValues).toEqual(2)
    table = table.replaceNonPositiveCellsForLogScale(["pop", "gdp"])
    expect(table.get("pop")?.numValues).toEqual(0)
    expect(table.get("gdp")?.numValues).toEqual(1)
    expect(table.get("births")?.numValues).toEqual(2)
})

it("can load a table from an array of arrays", () => {
    const sampleRows = [
        {
            year: 2020,
            time: 2020,
            entityName: "United States",
            population: 3e8,
            entityId: 1,
            entityCode: "USA",
        },
    ]
    const matrix = [
        Object.keys(sampleRows[0]),
        Object.values(sampleRows[0]),
    ] as any[][]
    const table = new CoreTable(rowsFromGrid(matrix))
    expect(table.numRows).toEqual(1)
    expect(table.numColumns).toEqual(6)
    expect(table.toMatrix()).toEqual(matrix)

    const tableTrim = new CoreTable(
        rowsFromGrid([
            ["country", null],
            ["usa", undefined],
        ])
    )
    expect(tableTrim.toMatrix()).toEqual([["country"], ["usa"]])
})
