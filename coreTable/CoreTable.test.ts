#! /usr/bin/env yarn jest

import { rowsFromGrid } from "grapher/utils/Util"
import { CoreTable } from "./CoreTable"
import { ColumnTypeNames } from "./CoreTableConstants"

const sampleCsv = `country,population
iceland,1
france,50
usa,300
canada,20`

describe("creating tables", () => {
    it("a table can be made from csv", () => {
        const table = new CoreTable(sampleCsv)
        expect(table.numRows).toEqual(4)
        expect(table.columnNames).toEqual(["country", "population"])
    })

    it("tables can be combined", () => {
        const table = new CoreTable(sampleCsv).concat(new CoreTable(sampleCsv))
        expect(table.numRows).toEqual(8)
    })

    it("can create a table from columns", () => {
        const table = new CoreTable({
            scores: [0, 1, 2],
            team: ["usa", "france", "canada"],
        })
        expect(table.numRows).toEqual(3)
        expect(table.columnNames).toEqual(["scores", "team"])
    })

    it("can create a table from csv", () => {
        const table = new CoreTable(sampleCsv)
        expect(table.numRows).toEqual(4)
        expect(table.columnNames).toEqual(["country", "population"])
        expect(table.columnTypes).toEqual(["String", "Numeric"])
        expect(table.columnJsTypes).toEqual(["string", "number"])
    })

    it("it always parses all values in all rows to Javascript primitives when the table is initially loaded", () => {
        const rows = [
            { country: "USA", gdp: 2000 },
            { country: "Germany", gdp: undefined },
        ]
        const table = new CoreTable(rows)
        expect(table.get("gdp")?.numValues).toEqual(1)
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

    it("can create a table with columns but no rows", () => {
        const table = new CoreTable({}, [{ slug: "entityId" }])
        expect(table.getValuesFor("entityId")).toEqual([])
    })
})

describe("adding rows", () => {
    it("rows can be added without mutating the parent table", () => {
        const table = new CoreTable(sampleCsv)
        expect(table.numRows).toEqual(4)

        let expandedTable = table.appendRows(
            [{ country: "Japan", population: 123 }],
            `Added 1 row`
        )
        expect(expandedTable.numRows).toBe(5)
        expect(table.numRows).toEqual(4)

        expandedTable = expandedTable
            .renameColumns({ population: "pop" })
            .appendRows(
                [{ country: "USA", pop: 321 }],
                "Added a row after column renaming"
            )
        expect(expandedTable.numRows).toEqual(6)
        expect(expandedTable.rows[5].pop).toEqual(321)
    })

    it("can drop rows", () => {
        const table = new CoreTable(sampleCsv)
        expect(table.dropRowsAt([0, 1, 3]).numRows).toEqual(1)
    })
})

describe("column operations", () => {
    it("can add a column from an array", () => {
        let table = new CoreTable({
            scores: [0, 1, 2],
            team: ["usa", "france", "canada"],
        })
        table = table.appendColumns([
            {
                slug: "population",
                values: [100, 200, 300],
            },
        ])
        expect(table.where({ team: "canada" }).rows[0].population).toEqual(300)
    })

    it("can rename a column", () => {
        let table = new CoreTable([{ pop: 123, year: 2000 }])
        table = table.renameColumns({ pop: "Population" })
        expect(table.columnSlugs).toEqual(["Population", "year"])
        const firstRow = table.firstRow as any
        expect(firstRow.Population).toEqual(123)
    })

    it("input rows are never mutated", () => {
        const rows = [{ country: "USA" }, { country: "Germany" }]
        const table = new CoreTable(rows, [
            {
                slug: "countryNameLength",
                fn: (row) => row.country.length,
            },
        ])
        expect(table.get("countryNameLength")?.parsedValues.join("")).toEqual(
            `37`
        )
        expect((rows[0] as any).countryNameLength).toEqual(undefined)
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
        table = table.updateDefs((def) => def)
        firstRow = table.firstRow as any
        expect(firstRow.count).toEqual(1)
    })

    it("can drop columns", () => {
        const rows = [
            { country: "USA", year: 1999 },
            { country: "Germany", year: 2000 },
        ]
        const table = new CoreTable(rows)
        expect(table.columnSlugs).toEqual(["country", "year"])
        expect(table.dropColumns(["year"]).columnSlugs).toEqual(["country"])
    })

    it("can transform columns", () => {
        const rows = [
            { country: "USA", year: 1999 },
            { country: "Germany", year: 2000 },
        ]
        const table = new CoreTable(rows)
        expect(table.columnNames).toEqual(["country", "Year"])
        expect(
            table.updateDefs((def) => {
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

        expect(
            table.grep("Germany").grep("2001").opposite.rows[0].year
        ).toEqual(2000)
        expect(table.grep(/(1999|2000)/).numRows).toEqual(2)
    })

    it("can filter columns as well", () => {
        expect(table.grepColumns("country").numColumns).toEqual(1)
        expect(table.grepColumns("r").numColumns).toEqual(2)
        expect(table.grepColumns("zz").numColumns).toEqual(0)
        expect(table.grepColumns("year").oppositeColumns.columnSlugs).toEqual([
            "country",
        ])
        expect(table.grepColumns(/co.+/).oppositeColumns.columnSlugs).toEqual([
            "year",
        ])
    })

    it("can get the domain across all columns", () => {
        const table = new CoreTable(
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
        const table = new CoreTable(csv)

        const annotationsColumn = table.get("notes")
        const entityNameMap = annotationsColumn!.getUniqueValuesGroupedBy(
            "entityName"
        )

        expect(entityNameMap.size).toEqual(2)
        expect(entityNameMap.get("hi")).toContain("in millions")
        expect(entityNameMap.get("usa")).toContain("in hundreds of millions")
    })
})

describe("filtering", () => {
    const rootTable = new CoreTable(sampleCsv)
    const filteredTable = rootTable.rowFilter(
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
        const filteredTwiceTable = filteredTable.rowFilter(
            (row: any) => (row.country as string).startsWith("u"),
            "Letter filter"
        )
        const parsedValues = filteredTwiceTable.get("country")!.parsedValues
        expect(parsedValues[0]).toEqual("usa")
        expect(parsedValues[1]).toEqual(undefined)
    })

    it("one filter works", () => {
        const table = new CoreTable(`country,pop
usa,123
can,333`)
        const allFiltered = table.rowFilter((row) => false, "filter all")
        expect(allFiltered.getValuesFor("pop")).toEqual([])
    })

    it("can filter negatives", () => {
        const table = new CoreTable(`country,pop
fra,0
usa,-2
can,333
ger,0.1`)
        expect(table.filterNegatives("pop").getValuesFor("pop")).toEqual([
            0,
            333,
            0.1,
        ])
    })
})

describe("debugging", () => {
    const table = new CoreTable(sampleCsv).dropColumns(["population"])

    it("tables have access to their ancestors", () => {
        expect(table.ancestors.length).toEqual(2)
    })
})

describe("printing", () => {
    it("uses slugs for headers in toDelimited", () => {
        const table = new CoreTable(`country,Population in 2020
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

        expect(table.constantColumns.length).toEqual(0)
        expect(table.toCsvWithColumnNames()).toEqual(`entityName,day,annotation
Aruba,2020-01-22,"Something, foo"
Canada,2020-01-23,`)
    })

    it("can format a value", () => {
        const table = new CoreTable(
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
})

describe("value operations", () => {
    it("can detect all integers", () => {
        const table = new CoreTable(`gdp,perCapita
123,123.1`)
        expect(table.get("gdp")?.isAllIntegers).toBeTruthy()
        expect(table.get("perCapita")?.isAllIntegers).toBeFalsy()
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
        expect(table.get("pop")?.numInvalidCells).toEqual(1)
        expect(table.numColumnsWithInvalidCells).toEqual(1)
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
})

describe("joins", () => {
    const leftTable = new CoreTable({
        country: ["usa", "can", "fra"],
        time: [2000, 2001, 2002],
        color: ["red", "green", "red"],
    })
    const rightTable = new CoreTable({
        country: ["usa", "can", "turk"],
        time: [2000, 2001, 2002],
        population: [55, 66, 77],
    })

    const expectedLeftJoin = `country time color population
usa 2000 red 55
can 2001 green 66
fra 2002 red `

    const expectedRightJoin = `country time population color
usa 2000 55 red
can 2001 66 green
turk 2002 77 `

    const expectedInner = `country time color population
usa 2000 red 55
can 2001 green 66`

    const expectedFull = `country time color population
usa 2000 red 55
can 2001 green 66
fra 2002 red 
turk 2002  77`

    it("can create indices", () => {
        const { index } = leftTable.rowIndex(["color"])
        expect(index.size).toEqual(2)
        const index2 = leftTable.rowIndex(["color", "country"])
        expect(index2.index.get("red usa")?.length).toEqual(1)
    })

    describe("outer joins", () => {
        it("can left join on all intersecting columns", () => {
            expect(leftTable.leftJoin(rightTable).toDelimited(" ")).toEqual(
                expectedLeftJoin
            )
        })

        it("can left join on one column", () => {
            expect(
                leftTable.leftJoin(rightTable, ["time"]).toDelimited(" ")
            ).toEqual(expectedLeftJoin + "77")
        })

        it("can do a right join", () => {
            expect(leftTable.rightJoin(rightTable).toDelimited(" ")).toEqual(
                expectedRightJoin
            )
        })
    })

    describe("inner joins", () => {
        it("can do a left inner join", () => {
            expect(leftTable.innerJoin(rightTable).toDelimited(" ")).toEqual(
                expectedInner
            )
        })
    })

    describe("full join", () => {
        it("can do a full join", () => {
            expect(leftTable.fullJoin(rightTable).toDelimited(" ")).toEqual(
                expectedFull
            )
        })
    })
})
