import { expect, it, describe } from "vitest"

import { CoreTable } from "./CoreTable.js"
import {
    TransformType,
    ColumnTypeNames,
    CoreColumnDef,
    CoreMatrix,
} from "@ourworldindata/types"
import { ErrorValueTypes, isNotErrorValue } from "./ErrorValues.js"
import { numericDefs } from "./testData/columnDefs.js"

const sampleRows: CoreMatrix = [
    ["country", "population"],
    ["iceland", 1],
    ["france", 50],
    ["usa", 300],
    ["canada", 20],
]

describe("creating tables", () => {
    const sampleCsv = `country,population
iceland,1
france,50
usa,300
canada,20`

    it("can create tables from csv", () => {
        const table = new CoreTable(sampleCsv)
        expect(table.numRows).toEqual(4)
        expect(table.columnNames).toEqual(["country", "population"])
    })

    it("can create tables from csv with columns definitions also as csv", () => {
        const table = new CoreTable(
            sampleCsv,
            `slug,name
country,Region
population,Population in 2020`
        )
        expect(table.numRows).toEqual(4)
        expect(table.columnNames).toEqual(["Region", "Population in 2020"])
    })

    describe("transforms", () => {
        it("can create columns from transforms", () => {
            const table = new CoreTable(sampleRows, [
                { slug: "country", name: "Region" },
                { slug: "population", name: "Population in 2020" },
                {
                    slug: "popTimes10",
                    name: "Pop times 10",
                    transform: "multiplyBy population 10",
                },
            ])
            expect(table.get("popTimes10").valuesIncludingErrorValues).toEqual([
                10, 500, 3000, 200,
            ])
        })

        describe("runs transforms just once", () => {
            const columnDefs: CoreColumnDef[] = [
                { slug: "country", name: "Region" },
                { slug: "population", name: "Population in 2020" },
                {
                    slug: "popChange",
                    name: "Pop change",
                    transform: "percentChange time country population 2",
                },
            ]
            const table = new CoreTable(
                [
                    ["country", "population"],
                    ["iceland", 1],
                    ["iceland", 2],
                    ["iceland", 3],
                    ["france", 50],
                    ["france", 60],
                    ["france", 75],
                ],
                columnDefs
            )
            const expected = [
                ErrorValueTypes.NoValueToCompareAgainst,
                ErrorValueTypes.NoValueToCompareAgainst,
                200,
                ErrorValueTypes.NoValueToCompareAgainst,
                ErrorValueTypes.NoValueToCompareAgainst,
                50,
            ]
            it("runs transforms correctly", () => {
                expect(
                    table.get("popChange").valuesIncludingErrorValues
                ).toEqual(expected)
            })

            it("runs transforms once", () => {
                expect(
                    table
                        .rowFilter((row, index) => !!index, "drop first")
                        .appendColumns([
                            { slug: "test", values: [1, 1, 1, 1, 1, 1] },
                        ])
                        .get("popChange").valuesIncludingErrorValues
                ).toEqual(expected.slice(1))
            })
        })

        describe("copies data & metadata for duplicate transform", () => {
            const table = new CoreTable(
                [
                    ["country", "population"],
                    ["iceland", 1],
                    ["iceland", 2],
                    ["france", 50],
                    ["france", 60],
                ],
                [
                    {
                        slug: "country",
                        name: "Region",
                    },
                    {
                        slug: "population",
                        name: "Population in 2020",
                        type: ColumnTypeNames.Integer,
                    },
                    {
                        slug: "pop2",
                        transform: "duplicate population",
                    },
                ]
            )
            const expected = [1, 2, 50, 60]
            it("runs transforms correctly", () => {
                expect(table.get("pop2").valuesIncludingErrorValues).toEqual(
                    expected
                )

                expect(table.get("pop2").def.name).toEqual("Population in 2020")
                expect(table.get("pop2").def.type).toEqual(
                    ColumnTypeNames.Integer
                )
            })
        })
    })

    it("can create an empty table", () => {
        expect(new CoreTable().transformCategory).toEqual(
            TransformType.LoadFromRowStore
        )
    })

    it("will only look at properties of the first object literal when autodetecting columns from rows", () => {
        const table = new CoreTable([{ name: "test" }, { score: 123 }])
        expect(table.columnNames).toEqual(["name"])
    })

    it("can combine tables", () => {
        const table = new CoreTable(sampleRows).concat([
            new CoreTable(sampleRows),
        ])
        expect(table.numRows).toEqual(8)
    })

    it("can drop empty rows", () => {
        const table = new CoreTable(`country,gdp\nusa,123\n,\n`)
        expect(table.dropEmptyRows().numRows).toEqual(1)
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

    it("can handle when a blank column type is provided", () => {
        expect(
            new CoreTable([], [{ slug: "gdp", type: "" as any }]).numRows
        ).toEqual(0)
    })

    it("always parses all values in all rows to Javascript primitives when the table is initially loaded", () => {
        const table = new CoreTable([
            ["country", "gdp"],
            ["USA", 2000],
            ["Germany", undefined],
        ])
        expect(table.get("gdp").numValues).toEqual(1)
    })

    it("parses values to the provided type even if first row is missing value", () => {
        const rows = `gdp,country
,usa
123,can`
        const table = new CoreTable(rows, [
            {
                slug: "gdp",
                type: ColumnTypeNames.Numeric,
            },
        ])
        expect(table.get("gdp").maxValue).toEqual(123)
    })

    it("doesn't parse values if skipParsing=true", () => {
        const table = new CoreTable(
            { gdp: ["abc", 123, undefined, null] as any },
            [
                {
                    slug: "gdp",
                    type: ColumnTypeNames.Numeric,
                    skipParsing: true,
                },
            ]
        )
        expect(table.get("gdp").valuesIncludingErrorValues).toEqual([
            "abc",
            123,
            undefined,
            null,
        ])
    })

    describe("loading from matrix", () => {
        const matrix: CoreMatrix = [
            [
                "year",
                "time",
                "entityName",
                "population",
                "entityId",
                "entityCode",
            ],
            [2020, 2020, "United States", 3e8, 1, "USA"],
        ]
        const table = new CoreTable(matrix)
        expect(table.numRows).toEqual(1)
        expect(table.numColumns).toEqual(6)
        expect(table.toMatrix()).toEqual(matrix)

        it("can delete columns", () => {
            const dropped = table.dropColumns(["entityId"])
            expect(dropped.toMatrix()[0].length).toEqual(5)
        })

        const tableTrim = new CoreTable([
            ["country", null],
            ["usa", undefined],
        ])
        expect(tableTrim.toMatrix()).toEqual([["country"], ["usa"]])
    })

    it("handles ErrorValues when serializing to a matrix", () => {
        const table = new CoreTable([
            ["country", "gdp"],
            ["usa", undefined],
        ])
        expect(table.toMatrix()[1][1]).toEqual(undefined)
    })

    it("can create a table with columns but no rows", () => {
        expect(
            new CoreTable([], [{ slug: "entityId" }]).get("entityId").values
        ).toEqual([])
    })

    it("can create a table with an empty column", () => {
        const table = new CoreTable(
            [["color"], ["blue"]],
            [{ slug: "name", type: ColumnTypeNames.String }]
        )
        expect(table.columnSlugs).toEqual(["name", "color"])
        expect(table.numRows).toEqual(1)
    })
})

it("can complete a table", () => {
    const table = new CoreTable([
        ["country", "year"],
        ["usa", 2000],
        ["usa", 2002],
        ["uk", 2001],
    ])
    expect(table.numRows).toEqual(3)
    const completed = table.complete(["country", "year"])

    expect(completed.numRows).toEqual(6)
    expect(completed.rows).toEqual(
        expect.arrayContaining([
            // compare in any order
            { country: "usa", year: 2000 },
            { country: "usa", year: 2001 },
            { country: "usa", year: 2002 },
            { country: "uk", year: 2000 },
            { country: "uk", year: 2001 },
            { country: "uk", year: 2002 },
        ])
    )
})

it("can sort a table", () => {
    const table = new CoreTable([
        ["country", "year", "population"],
        ["uk", 1800, 100],
        ["iceland", 1700, 200],
        ["iceland", 1800, 300],
        ["uk", 1700, 400],
        ["germany", 1400, 500],
    ])

    const sorted = table.sortBy(["country", "year"])
    expect(sorted.rows).toEqual([
        { country: "germany", year: 1400, population: 500 },
        { country: "iceland", year: 1700, population: 200 },
        { country: "iceland", year: 1800, population: 300 },
        { country: "uk", year: 1700, population: 400 },
        { country: "uk", year: 1800, population: 100 },
    ])
})

describe("adding rows", () => {
    describe("adding rows is immutable", () => {
        const table = new CoreTable(sampleRows)
        expect(table.numRows).toEqual(4)

        let expandedTable = table.appendRows(
            [{ country: "Japan", population: 123 }],
            `Added 1 row`
        )
        expect(expandedTable.numRows).toBe(5)
        expect(table.numRows).toEqual(4)

        it("can append rows", () => {
            expandedTable = expandedTable
                .renameColumns({ population: "pop" })
                .appendRows(
                    [{ country: "USA", pop: 321 }],
                    "Added a row after column renaming"
                )
            expect(expandedTable.numRows).toEqual(6)
            expect(expandedTable.rows[5].pop).toEqual(321)
        })
    })

    it("can drop rows", () => {
        const table = new CoreTable(sampleRows)
        expect(table.dropRowsAt([0, 1, 3]).numRows).toEqual(1)
    })
})

describe("column operations", () => {
    it("can add a column from an array", () => {
        let table = new CoreTable([
            ["scores", "team"],
            [0, "usa"],
            [1, "france"],
            [2, "canada"],
        ])
        table = table.appendColumns([
            {
                slug: "population",
                values: [100, 200, 300],
            },
        ])
        expect(table.where({ team: "canada" }).rows[0].population).toEqual(300)
    })

    it("can rename a column", () => {
        let table = new CoreTable([
            ["pop", "year"],
            [123, 2000],
        ])
        table = table.renameColumns({ pop: "Population" })
        expect(table.columnSlugs).toEqual(["Population", "year"])
        const firstRow = table.firstRow as any
        expect(firstRow.Population).toEqual(123)
    })

    it("does not mutate input rows ever", () => {
        const rows = [{ country: "USA" }, { country: "Germany" }]
        const table = new CoreTable(rows, [
            {
                slug: "countryNameLength",
                values: rows.map((row) => row.country.length),
            },
        ])
        expect(table.get("countryNameLength").values.join("")).toEqual(`37`)
        expect((rows[0] as any).countryNameLength).toEqual(undefined)
    })

    it("can drop columns", () => {
        const table = new CoreTable([
            ["country", "year"],
            ["USA", 1999],
            ["Germany", 2000],
        ])
        expect(table.columnSlugs).toEqual(["country", "year"])
        expect(table.dropColumns(["year"]).columnSlugs).toEqual(["country"])
    })

    it("can select a set of columns", () => {
        const table = new CoreTable([
            ["country", "year", "gdp"],
            ["USA", 1999, 10001],
            ["Germany", 2000, 20002],
        ])
        expect(table.columnSlugs).toEqual(["country", "year", "gdp"])
        expect(table.select(["country", "gdp"]).columnSlugs).toEqual([
            "country",
            "gdp",
        ])
    })

    it("can transform columns", () => {
        const table = new CoreTable([
            ["country", "year"],
            ["USA", 1999],
            ["Germany", 2000],
        ])
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
})

describe("searching", () => {
    const table = new CoreTable([
        ["country", "year"],
        ["USA", 1999],
        ["Germany", 2000],
        ["Germany", 2001],
    ])

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

    it("can do grep like searching to find rows", () => {
        expect(table.grep("Germany").numRows).toEqual(2)
        expect(table.grep("USA").numRows).toEqual(1)
        expect(table.grep("USA").numRows).toEqual(1)
        expect(table.grep("Missing").numRows).toEqual(0)
        expect(table.grep("200").numRows).toEqual(2)
        expect(table.grep(/20\d+/).numRows).toEqual(2)

        expect(table.grep(/(1999|2000)/).numRows).toEqual(2)
    })

    it("can get the domain across all columns", () => {
        const table = new CoreTable(
            [
                ["gdp", "perCapita"],
                [0, 123.1],
                [12, 300],
                [20, 40],
            ],
            numericDefs("gdp", "perCapita")
        )
        const domainFor = table.domainFor(["gdp", "perCapita"])
        expect(domainFor).toEqual([0, 300])
    })

    it("can get annotations for a row", () => {
        const table = new CoreTable([
            ["entityName", "pop", "notes", "year"],
            ["usa", 322, "in hundreds of millions", 2000],
            ["hi", 1, "in millions", 2000],
            ["hi", 1, null, 2001],
        ])

        const annotationsColumn = table.get("notes")
        const entityNameMap =
            annotationsColumn.getUniqueValuesGroupedBy("entityName")

        expect(entityNameMap.size).toEqual(2)
        expect(entityNameMap.get("hi")).toContain("in millions")
        expect(entityNameMap.get("usa")).toContain("in hundreds of millions")
    })
})

describe("filtering", () => {
    describe("row filter", () => {
        const rootTable = new CoreTable(sampleRows)
        const filteredTable = rootTable.rowFilter(
            (row) => parseInt(row.population) > 40,
            "Pop filter"
        )
        it("can filter", () => {
            expect(rootTable.get("country").values[3]).toEqual("canada")
            const parsedValues = filteredTable.get("country").values
            expect(parsedValues[0]).toEqual("france")
            expect(parsedValues[1]).toEqual("usa")
        })

        it("can chain filters", () => {
            const filteredTwiceTable = filteredTable.rowFilter(
                (row: any) => (row.country as string).startsWith("u"),
                "Letter filter"
            )
            const parsedValues = filteredTwiceTable.get("country").values
            expect(parsedValues[0]).toEqual("usa")
            expect(parsedValues[1]).toEqual(undefined)
        })

        it("can filter all", () => {
            const table = new CoreTable([
                ["country", "pop"],
                ["usa", 123],
                ["can", 333],
            ])
            const allFiltered = table.rowFilter(() => false, "filter all")
            expect(allFiltered.get("pop").values).toEqual([])
        })
    })

    describe("column filter", () => {
        const rootTable = new CoreTable(sampleRows)
        const filteredTable = rootTable.columnFilter(
            "population",
            (v) => parseInt(v as any) > 40,
            "Pop filter"
        )

        it("can filter", () => {
            expect(rootTable.get("country").values[3]).toEqual("canada")
            const parsedValues = filteredTable.get("country").values
            expect(parsedValues[0]).toEqual("france")
            expect(parsedValues[1]).toEqual("usa")
        })

        it("can chain filters", () => {
            const filteredTwiceTable = filteredTable.columnFilter(
                "country",
                (v) => (v as string).startsWith("u"),
                "Letter filter"
            )
            const parsedValues = filteredTwiceTable.get("country").values
            expect(parsedValues[0]).toEqual("usa")
            expect(parsedValues[1]).toEqual(undefined)
        })

        it("can filter error values", () => {
            const table = new CoreTable(
                [
                    ["country", "value"],
                    ["usa", null],
                    ["usa", "1"],
                ],
                [
                    { slug: "country", type: ColumnTypeNames.String },
                    { slug: "value", type: ColumnTypeNames.Numeric },
                ]
            )
            expect(
                table.columnFilter(
                    "value",
                    (v) => isNotErrorValue(v),
                    "filter out error values"
                ).numRows
            ).toEqual(1)
        })

        it("can filter all", () => {
            const table = new CoreTable([
                ["country", "pop"],
                ["usa", 123],
                ["can", 333],
            ])
            const allFiltered = table.columnFilter(
                "pop",
                () => false,
                "filter all"
            )
            expect(allFiltered.get("pop").values).toEqual([])
        })
    })
})

describe("debug tools", () => {
    const table = new CoreTable(sampleRows).dropColumns(["population"])

    it("can dump its ancestors", () => {
        expect(table.ancestors.length).toEqual(2)
    })
})

describe("value operations", () => {
    it("can detect all integers", () => {
        const table = new CoreTable([
            ["gdp", "perCapita"],
            [123, 123.1],
        ])
        expect(table.get("gdp").isAllIntegers).toBeTruthy()
        expect(table.get("perCapita").isAllIntegers).toBeFalsy()
    })

    it("can get all defined values for a column", () => {
        const table = new CoreTable(
            [
                ["pop", "year"],
                [undefined, 1999],
                [123, 2000],
            ],
            numericDefs("pop")
        )
        expect(table.get("pop").numValues).toEqual(1)
        expect(table.get("pop").numErrorValues).toEqual(1)
        expect(table.numColumnsWithErrorValues).toEqual(1)
    })

    it("can replace cells for log scale", () => {
        let table = new CoreTable([
            ["pop", "gdp", "births"],
            [-20, 100, -4],
            [0, -2, 20],
        ])
        expect(table.get("pop").numValues).toEqual(2)
        expect(table.get("gdp").numValues).toEqual(2)
        table = table.replaceNonPositiveCellsForLogScale(["pop", "gdp"])
        expect(table.get("pop").numValues).toEqual(0)
        expect(table.get("gdp").numValues).toEqual(1)
        expect(table.get("births").numValues).toEqual(2)
    })
})

describe("index", () => {
    const leftTable = new CoreTable([
        ["country", "time", "color"],
        ["usa", 2000, "red"],
        ["can", 2001, "green"],
        ["fra", 2002, "red"],
    ])

    it("can create indices", () => {
        const index = leftTable.rowIndex(["color"])
        expect(index.size).toEqual(2)
        const index2 = leftTable.rowIndex(["color", "country"])
        expect(index2.get("red usa")?.length).toEqual(1)
    })
})
