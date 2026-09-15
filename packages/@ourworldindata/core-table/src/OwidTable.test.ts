import { expect, it, describe } from "vitest"

import {
    SampleColumnSlugs,
    SynthesizeFruitTable,
    SynthesizeGDPTable,
} from "./OwidTableSynthesizers.js"
import { OwidTable } from "./OwidTable.js"
import { numericDefs, yearDef } from "./testData/columnDefs.js"
import {
    ColumnTypeNames,
    CoreMatrix,
    OwidColumnDef,
    OwidTableSlugs,
} from "@ourworldindata/types"
import { ErrorValueTypes } from "./ErrorValues.js"

const sampleRows: CoreMatrix = [
    ["year", "time", "entityName", "population", "entityId", "entityCode"],
    [2020, 2020, "United States", 3e8, 1, "USA"],
]

it("can create a table and detect columns", () => {
    const table = new OwidTable(sampleRows)
    expect(table.numRows).toEqual(1)
    expect(table.numColumns).toEqual(6)
})

it("can create a new table by adding a column", () => {
    const table = new OwidTable(sampleRows, [
        { slug: "populationInMillions", values: [3e8 / 1000000] },
    ])
    expect(table.rows[0].populationInMillions).toEqual(300)
})

it("can parse data to Javascript data structures", () => {
    const table = SynthesizeGDPTable({
        timeRange: [2000, 2010],
    })

    const parsed = table.get("Population").values
    expect(parsed.filter((item) => isNaN(item))).toEqual([])

    table.get("Population").owidRows.forEach((row) => {
        expect(typeof row.entityName).toBe("string")
        expect(row.value).toBeGreaterThan(100)
        expect(row.originalTime).toBeGreaterThan(1999)
    })
})

it("can drop random cells", () => {
    const table = SynthesizeGDPTable({
        timeRange: [2000, 2010],
        entityCount: 1,
    })
    expect(table.get(SampleColumnSlugs.GDP).numValues).toBe(10)
    expect(
        table
            .replaceRandomCells(7, [SampleColumnSlugs.GDP])
            .get(SampleColumnSlugs.GDP).numValues
    ).toBe(3)
})

it("can group data by entity and time", () => {
    const table = SynthesizeGDPTable({
        timeRange: [2000, 2010],
        entityCount: 5,
    })

    const timeValues = Array.from(
        table.get("Population").valueByEntityNameAndOriginalTime.values()
    ).flatMap((value) => Array.from(value.values()))

    expect(timeValues.length).toEqual(50)
    expect(timeValues.filter((value) => isNaN(value as number))).toEqual([])
})

describe("timeColumn", () => {
    it("uses 'time' as the canonical timeColumn", () => {
        const rows: CoreMatrix = [
            [
                OwidTableSlugs.EntityName,
                OwidTableSlugs.Time,
                "year",
                "day",
                "x",
            ],
            ["usa", 2000, 2000, "2000-01-01", 0],
        ]
        const colDefs: OwidColumnDef[] = [
            {
                slug: "year",
                type: ColumnTypeNames.Year,
            },
            {
                slug: "day",
                type: ColumnTypeNames.Day,
            },
            {
                slug: OwidTableSlugs.Time,
                type: ColumnTypeNames.Year,
            },
            {
                slug: "x",
                type: ColumnTypeNames.Numeric,
            },
        ]
        const table = new OwidTable(rows, colDefs)
        expect(table.timeColumn.slug).toEqual(OwidTableSlugs.Time)
    })

    it("prefers a day column when both year and day are in the chart", () => {
        const table = new OwidTable([
            ["entityName", "entityCode", "entityId", "pop", "year", "day"],
            ["usa", "usa", 1, 322, 2000, 2],
        ])
        expect(table.timeColumn.slug).toBe("day")
    })
})

it("can get the latest values for an entity", () => {
    const table = new OwidTable([
        ["entityName", "entityCode", "entityId", "pop", "year", "coal"],
        ["usa", "usa", 1, 322, 2000, 10],
        ["usa", "usa", 1, 322, 2001, null],
        ["usa", "usa", 1, 4, 2002, null],
    ])
    expect(table.getLatestValueForEntity("usa", "coal")).toBe(10)
    expect(table.getLatestValueForEntity("usa", "pop")).toBe(4)
    expect(table.getLatestValueForEntity("does not exit", "pop")).toBe(
        undefined
    )
})

it("can synth numerics", () => {
    const table = SynthesizeGDPTable({
        timeRange: [2000, 2001],
        entityCount: 1,
    })

    const row = table.get("GDP").owidRows[0]
    expect(typeof row.value).toEqual("number")
})

const basicTableRows: CoreMatrix = [
    ["entityName", "entityCode", "entityId", "gdp", "pop"],
    ["iceland", "ice", 1, 123123456.2, 3],
    ["usa", "us", 2, 23, null],
    ["france", "fr", 3, 23, 4],
]

it("can get entities with required columns", () => {
    const table = new OwidTable(basicTableRows)
    expect(table.get("pop").def.type).toEqual(ColumnTypeNames.Numeric)
    expect(table.get("pop").uniqEntityNames.length).toEqual(2)
    expect(table.entitiesWith(["gdp"]).size).toEqual(3)
    expect(table.entitiesWith(["gdp", "pop"]).size).toEqual(2)
})

it("can export a clean csv", () => {
    const table = new OwidTable(basicTableRows)
    expect(table.toPrettyCsv()).toEqual(`Entity,Code,gdp,pop
france,fr,23,4
iceland,ice,123123456.2,3
usa,us,23,`)
})

it("can handle columns with commas", () => {
    const table = new OwidTable(basicTableRows)
    table.get("gdp").def.name = "Gross, Domestic, Product"
    expect(table.toPrettyCsv())
        .toEqual(`Entity,Code,"Gross, Domestic, Product",pop
france,fr,23,4
iceland,ice,123123456.2,3
usa,us,23,`)
})

describe("time filtering", () => {
    it("can filter by time domain", () => {
        const table = SynthesizeGDPTable({
            entityCount: 2,
            timeRange: [2000, 2005],
        })

        expect(table.numRows).toBe(10)
        expect(table.filterByTimeRange(2000, 2003).numRows).toBe(8)
        expect(table.filterByTimeRange(2000, 2000).numRows).toBe(2)
    })

    it("can get time options", () => {
        const table = SynthesizeGDPTable({
            entityCount: 2,
            timeRange: [2000, 2003],
        })

        const timeOptions = table.getTimesUniqSortedAscForColumns([
            SampleColumnSlugs.GDP,
        ])
        expect(timeOptions).toEqual([2000, 2001, 2002])
    })

    it("time options are sorted in ascending order", () => {
        const table = new OwidTable([
            ["entityName", "entityId", "entityCode", "day", "value"],
            ["usa", 1, "usa", -4, 1],
            ["usa", 1, "usa", 1, 1],
            ["usa", 1, "usa", -5, 1],
        ])
        const timeOptions = table.getTimesUniqSortedAscForColumns(["value"])
        expect(timeOptions).toEqual([-5, -4, 1])
    })

    it("can handle infinity when filtering", () => {
        const table = SynthesizeGDPTable({
            entityCount: 2,
            timeRange: [2000, 2005],
        })

        expect(table.numRows).toBe(10)
        expect(table.filterByTimeRange(Infinity, Infinity).numRows).toBe(2)
        expect(table.filterByTimeRange(-Infinity, -Infinity).numRows).toBe(2)
        expect(table.filterByTimeRange(-Infinity, Infinity).numRows).toBe(10)
    })

    it("can filter by time target", () => {
        const table = SynthesizeGDPTable(
            {
                entityCount: 2,
                timeRange: [2000, 2005],
            },
            1
        )

        expect(table.numRows).toBe(10)
        expect(table.filterByTargetTimes([2010], 2).numRows).toBe(0)
        expect(table.filterByTargetTimes([2010], 20).numRows).toBe(2)

        expect(
            table
                .filterByEntityNames(table.sampleEntityName(1))
                .filterByTargetTimes([2010], 20).numRows
        ).toBe(1)

        const table2 = SynthesizeGDPTable({
            entityCount: 1,
            timeRange: [2000, 2001],
        })

        expect(table2.filterByTargetTimes([2000], 1).numRows).toBe(1)
    })

    it("can filter by multiple time targets", () => {
        const table = SynthesizeGDPTable(
            {
                entityCount: 2,
                timeRange: [2000, 2005],
            },
            1
        )

        expect(table.numRows).toBe(10)
        expect(table.filterByTargetTimes([2000, 2002], 0).numRows).toBe(4)

        expect(
            table
                .filterByEntityNames(table.sampleEntityName(1))
                .filterByTargetTimes([2000, 2003], 1).numRows
        ).toBe(2)

        const table2 = SynthesizeGDPTable({
            entityCount: 1,
            timeRange: [2000, 2001],
        })

        expect(table2.filterByTargetTimes([2000, 2007], 1).numRows).toBe(1)
    })

    it("keeps the correct row when entity times are unsorted and tolerance is used", () => {
        const table = new OwidTable([
            ["entityName", "entityId", "entityCode", "time", "value"],
            ["usa", 1, "usa", 2001, 1],
            ["usa", 1, "usa", 2000, 2],
        ])

        const filtered = table.filterByTargetTimes([2000], 1)

        expect(filtered.numRows).toBe(1)
        expect(filtered.get("time").values[0]).toBe(2000)
        expect(filtered.get("value").values[0]).toBe(2)
    })
})

describe("rolling averages", () => {
    const rows: CoreMatrix = [
        [
            "year",
            "time",
            "entityName",
            "population",
            "entityId",
            "entityCode",
            "continent",
        ],
        [2020, 2020, "United States", 3e8, 1, "USA", "North America"],
        [2020, 2020, "World", 10e8, 12, "World", ""],
        [2020, 2020, "United States", 3e8, 1, "USA", "North America"],
    ]
    const [header, ...dataRows] = rows
    const table = new OwidTable(rows)
    it("a column can be added", () => {
        expect(table.numRows).toEqual(dataRows.length)
        expect(table.numColumns).toEqual(header.length)
        const newTable = table.appendColumns([
            {
                slug: "populationInMillions",
                values: table
                    .get("population")
                    .values.map((population) => population / 1000000),
            },
        ])
        expect(newTable.rows[0].populationInMillions).toEqual(300)
        expect(newTable.numColumns).toEqual(header.length + 1)
    })

    // sortedUniqNonEmptyStringVals
    it("can get values for color legend", () => {
        expect(
            table.get("continent").sortedUniqNonEmptyStringVals.length
        ).toEqual(1)
    })
})

describe("relative mode", () => {
    // 2 columns. 2 countries. 2 years
    let table = SynthesizeFruitTable({
        entityCount: 2,
        timeRange: [2000, 2002],
    })

    table.rows.forEach((row) => {
        expect(row.Fruit).toBeGreaterThan(100)
    })
    table = table.toPercentageFromEachColumnForEachEntityAndTime([
        SampleColumnSlugs.Fruit,
        SampleColumnSlugs.Vegetables,
    ])
    table.rows.forEach((row) => {
        expect(Math.round(Number(row.Fruit) + Number(row.Vegetables))).toEqual(
            100
        )
    })

    it("works with missing values", () => {
        let table = SynthesizeFruitTable({
            entityCount: 2,
            timeRange: [2000, 2002],
        }).replaceRandomCells(
            1,
            [SampleColumnSlugs.Fruit, SampleColumnSlugs.Vegetables],
            1
        )

        table = table.toPercentageFromEachColumnForEachEntityAndTime([
            SampleColumnSlugs.Fruit,
            SampleColumnSlugs.Vegetables,
        ])
        expect(table.get(SampleColumnSlugs.Fruit).numErrorValues).toEqual(1)
    })
})

describe("time domain", () => {
    it("can get the time domain across columns", () => {
        const table = new OwidTable(
            [
                [
                    "gdp",
                    "perCapita",
                    "day",
                    "entityName",
                    "entityId",
                    "entityCode",
                ],
                [0, 123.1, 0, "usa", null, null],
                [12, 300, 1, "usa", null, null],
                [20, null, 2, "usa", null, null],
            ],
            [
                ...numericDefs("gdp", "perCapita"),
                { slug: "day", type: ColumnTypeNames.Day },
            ]
        )

        expect(table.timeDomainFor(["gdp", "perCapita"])).toEqual([0, 2])
        expect(table.timeDomainFor(["perCapita"])).toEqual([0, 1])
    })

    it("can get minTime and maxTimes when years are initially unsorted", () => {
        const table = new OwidTable(
            [
                ["gdp", "day", "entityName", "entityId", "entityCode"],
                [0, 2000, "usa", null, null],
                [12, 1950, "usa", null, null],
                [20, 1970, "usa", null, null],
            ],
            [...numericDefs("gdp"), { slug: "day", type: ColumnTypeNames.Day }]
        )

        expect(table.get("gdp").minTime).toEqual(1950)
        expect(table.get("gdp").maxTime).toEqual(2000)
        expect(table.get("gdp").uniqTimesAsc).toEqual([1950, 1970, 2000])
    })
})

describe("linear interpolation", () => {
    const table = new OwidTable(
        [
            ["gdp", "year", "entityName"],
            [10, 2000, "france"],
            [0, 2001, "france"],
            [null, 2002, "france"],
            [null, 2003, "france"],
            [8, 2005, "france"],
            [null, 2006, "france"],
            [2, 2000, "uk"],
            [3, 2004, "uk"],
        ],
        [...numericDefs("gdp"), yearDef()]
    )

    it("applies interpolation without extrapolation", () => {
        const interpolatedTable = table.interpolateColumnLinearly("gdp", false)

        expect(interpolatedTable.get("gdp").valuesIncludingErrorValues).toEqual(
            [
                // France
                10,
                0,
                2,
                4,
                6,
                8,
                ErrorValueTypes.NoValueForInterpolation,
                // UK
                2,
                2.25,
                2.5,
                2.75,
                3,
                ErrorValueTypes.NoValueForInterpolation,
                ErrorValueTypes.NoValueForInterpolation,
            ]
        )

        // Check that not only the gdp values are correct but also the other fields
        expect(interpolatedTable.rows).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    entityName: "france",
                    gdp: 2,
                    year: 2002,
                }),
            ])
        )
        expect(
            interpolatedTable.rows.filter(
                (row) => row.year !== undefined && isNaN(row.year)
            ).length
        ).toEqual(0)
    })

    it("applies interpolation with extrapolation", () => {
        const interpolatedTable = table.interpolateColumnLinearly("gdp", true)

        expect(interpolatedTable.get("gdp").valuesIncludingErrorValues).toEqual(
            [
                // France
                10, 0, 2, 4, 6, 8, 8,
                // UK
                2, 2.25, 2.5, 2.75, 3, 3, 3,
            ]
        )

        // Check that not only the gdp values are correct but also the other fields
        expect(interpolatedTable.rows).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    entityName: "france",
                    gdp: 2,
                    year: 2002,
                }),
            ])
        )
        expect(
            interpolatedTable.rows.filter(
                (row) => row.year !== undefined && isNaN(row.year)
            ).length
        ).toEqual(0)
    })

    it("keeps the original values when applied twice", () => {
        const once = table.interpolateColumnLinearly("gdp", false)
        const twice = once.interpolateColumnLinearly("gdp", false)

        expect(twice.get("gdp").originalValues).toEqual(
            once.get("gdp").originalValues
        )
    })
})

describe("tolerance", () => {
    const table = new OwidTable(
        [
            ["gdp", "year", "entityName", "entityId", "entityCode"],
            [null, 2000, "france", 1, null],
            [2, 2000, "uk", 2, null],
            [0, 2001, "france", 1, null],
            [null, 2002, "france", 1, null],
            [null, 2003, "france", 1, null],
            [3, 2004, "uk", 2, null],
            [1, 2005, "france", 1, null],
            [null, 2006, "france", 1, null],
        ],
        [...numericDefs("gdp"), yearDef()]
    )

    function applyTolerance(table: OwidTable): OwidTable {
        return table.interpolateColumnWithTolerance("gdp", {
            toleranceOverride: 1,
        })
    }

    // Applying the tolerance twice to ensure operation is idempotent.
    it("applies tolerance to a column", () => {
        const toleranceTable = applyTolerance(table)
        expect(toleranceTable.rows).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    entityName: "france",
                    gdp: 0,
                    year: 2000,
                    "gdp-originalTime": 2001,
                }),
            ])
        )
        expect(toleranceTable.rows).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    entityName: "france",
                    gdp: ErrorValueTypes.NoValueWithinTolerance,
                    year: 2003,
                    "gdp-originalTime": 2003,
                }),
            ])
        )
        expect(toleranceTable.rows).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    entityName: "uk",
                    gdp: 3,
                    year: 2004,
                    "gdp-originalTime": 2004,
                }),
            ])
        )
        expect(toleranceTable.rows).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    entityName: "uk",
                    gdp: 3,
                    year: 2005,
                    "gdp-originalTime": 2004,
                }),
            ])
        )
        expect(toleranceTable.rows).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    entityName: "france",
                    gdp: 1,
                    year: 2006,
                    "gdp-originalTime": 2005,
                }),
            ])
        )
        expect(
            toleranceTable.rows.filter(
                (row) => row.year !== undefined && isNaN(row.year)
            ).length
        ).toEqual(0)
    })

    it("tolerance application is idempotent", () => {
        expect(applyTolerance(table).rows).toEqual(
            applyTolerance(applyTolerance(table)).rows
        )
    })

    it("doesn't leak between entities", () => {
        const table = new OwidTable(
            [
                ["gdp", "year", "entityName", "entityId", "entityCode"],
                [null, 2000, "france", 1, null],
                [null, 2000, "germany", 1, null],
                [null, 2001, "germany", 1, null],
                [3, 2000, "uk", 2, null],
                [null, 2001, "uk", 2, null],
            ],
            [...numericDefs("gdp"), yearDef()]
        )
        const toleranceTable = table.interpolateColumnWithTolerance("gdp", {
            toleranceOverride: 1,
        })
        // tests assume sorted by [entityName, year]
        expect(
            toleranceTable.get("entityName")?.valuesIncludingErrorValues
        ).toEqual(["france", "france", "germany", "germany", "uk", "uk"])
        expect(toleranceTable.get("gdp")?.valuesIncludingErrorValues).toEqual([
            ErrorValueTypes.NoValueWithinTolerance,
            ErrorValueTypes.NoValueWithinTolerance,
            ErrorValueTypes.NoValueWithinTolerance,
            ErrorValueTypes.NoValueWithinTolerance,
            3,
            3,
        ])
    })
})

it("assigns originalTime as 'originalTime' in owidRows", () => {
    const table = new OwidTable([
        ["gdp", "year", "entityName", "entityId", "entityCode"],
        [1000, 2019, "USA", null, null],
        [1001, 2020, "UK", null, null],
    ]).interpolateColumnWithTolerance("gdp", {
        toleranceOverride: 1,
    })
    const owidRows = table.get("gdp").owidRows
    expect(owidRows).toEqual(
        expect.not.arrayContaining([
            expect.objectContaining({
                entityName: "USA",
                originalTime: 2020,
                value: 1000,
            }),
        ])
    )
    expect(owidRows).toEqual(
        expect.not.arrayContaining([
            expect.objectContaining({
                entityName: "UK",
                originalTime: 2019,
                value: 1001,
            }),
        ])
    )
})

it("handles tsv column definitions", () => {
    const rows: CoreMatrix = [
        ["gdp", "annotation", "year", "entityName", "entityId", "entityCode"],
        [1000, "low", 2019, "USA", null, null],
        [1001, "high", 2020, "UK", null, null],
    ]
    const defTsv = `slug	annotationsColumnSlug
gdp	annotation`
    const table = new OwidTable(rows, defTsv)
    expect(table.get("gdp").def.annotationsColumnSlug).toEqual("annotation")
})

describe("printing", () => {
    it("can export a clean csv with dates", () => {
        const table = new OwidTable(
            [
                ["entityName", "day", "annotation"],
                ["Aruba", 1, "Something, foo"],
                ["Canada", 2, null],
            ],
            [
                { slug: "entityName" },
                { slug: "day", type: "Day" as any },
                { slug: "annotation" },
            ]
        )

        expect(table.toCsv()).toEqual(`entityName,day,annotation
Aruba,2020-01-22,"Something, foo"
Canada,2020-01-23,`)
    })

    it("can format a value", () => {
        const table = new OwidTable(
            [["growthRate"], [123]],
            [
                {
                    slug: "growthRate",
                    display: { unit: "%" },
                    type: ColumnTypeNames.Numeric,
                },
            ]
        )
        expect(table.get("growthRate").formatValueShort(20)).toEqual("20%")
    })
})

describe("toPrettyCsv", () => {
    it("formats basic line chart data with full display names", () => {
        const table = new OwidTable(
            [
                ["entityName", "entityCode", "year", "gdp", "population"],
                ["France", "FRA", 2020, 2500, 67000000],
                ["Germany", "DEU", 2020, 3500, 83000000],
                ["France", "FRA", 2021, 2600, 67500000],
            ],
            [
                {
                    slug: "gdp",
                    type: ColumnTypeNames.Numeric,
                    name: "Gross Domestic Product",
                },
                {
                    slug: "population",
                    type: ColumnTypeNames.Numeric,
                    name: "Total Population",
                },
            ]
        )

        const csv = table.toPrettyCsv()
        expect(csv).toContain("Gross Domestic Product")
        expect(csv).toContain("Total Population")
        expect(csv).toContain("Entity")
        expect(csv).toContain("Code")
        expect(csv).toContain("Year")
        // Columns are in table order, data columns come first
        expect(csv).toContain("2500,67000000,France,FRA,2020")
    })

    it("uses short names when useShortNames is true", () => {
        const table = new OwidTable(
            [
                ["entityName", "entityCode", "year", "gdp"],
                ["France", "FRA", 2020, 2500],
            ],
            [
                {
                    slug: "gdp",
                    type: ColumnTypeNames.Numeric,
                    name: "Gross Domestic Product (constant 2015 US$)",
                    shortName: "GDP",
                },
            ]
        )

        const csv = table.toPrettyCsv({ useShortNames: true })
        expect(csv).toContain("GDP")
        expect(csv).not.toContain("Gross Domestic Product")
    })

    it("handles projection columns correctly", () => {
        const table = new OwidTable(
            [
                ["entityName", "entityCode", "year", "pop", "pop_proj"],
                ["France", "FRA", 2020, 67000000, null],
                ["France", "FRA", 2030, null, 70000000],
            ],
            [
                {
                    slug: "pop",
                    type: ColumnTypeNames.Numeric,
                    name: "Population",
                },
                {
                    slug: "pop_proj",
                    type: ColumnTypeNames.Numeric,
                    name: "Population",
                    display: { isProjection: true },
                },
            ]
        )

        const csv = table.toPrettyCsv()
        expect(csv).toContain("Population")
        expect(csv).toContain("Population (Projected)")
    })

    it("formats original time columns", () => {
        const table = new OwidTable(
            [
                ["entityName", "entityCode", "year", "gdp", "gdp-originalTime"],
                ["France", "FRA", 2020, 2500, 2019],
                ["France", "FRA", 2021, 2600, 2021],
            ],
            [
                {
                    slug: "gdp",
                    type: ColumnTypeNames.Numeric,
                    name: "GDP",
                },
                {
                    slug: "gdp-originalTime",
                    type: ColumnTypeNames.Year,
                    derivedFrom: {
                        columnSlug: "gdp",
                        relationship: "originalTime",
                    },
                },
            ]
        )

        const csv = table.toPrettyCsv()
        expect(csv).toContain("GDP (Original Year)")
        expect(csv).toContain("2019")
    })

    it("handles columns with targetTime", () => {
        const table = new OwidTable(
            [
                ["entityName", "entityCode", "year", "gdp"],
                ["France", "FRA", 2020, 2500],
            ],
            [
                {
                    slug: "gdp",
                    type: ColumnTypeNames.Numeric,
                    name: "GDP",
                    targetTime: 2030,
                },
            ]
        )

        const csv = table.toPrettyCsv()
        expect(csv).toContain("GDP in 2030")
    })

    it("handles day columns", () => {
        const table = new OwidTable(
            [
                ["entityName", "entityCode", "day", "cases"],
                ["France", "FRA", 0, 100],
                ["France", "FRA", 1, 150],
            ],
            [
                {
                    slug: "day",
                    type: ColumnTypeNames.Day,
                },
                {
                    slug: "cases",
                    type: ColumnTypeNames.Numeric,
                    name: "COVID Cases",
                },
            ]
        )

        const csv = table.toPrettyCsv()
        expect(csv).toContain("Entity")
        expect(csv).toContain("Code")
        expect(csv).toContain("Day")
        expect(csv).toContain("COVID Cases")
    })

    it("sorts by entityName by default", () => {
        const table = new OwidTable([
            ["entityName", "entityCode", "year", "value"],
            ["Zambia", "ZMB", 2020, 10],
            ["Algeria", "DZA", 2020, 20],
            ["Brazil", "BRA", 2020, 30],
        ])

        const csv = table.toPrettyCsv()
        const lines = csv.split("\n")
        expect(lines[1]).toContain("Algeria")
        expect(lines[2]).toContain("Brazil")
        expect(lines[3]).toContain("Zambia")
    })

    it("allows custom sort order", () => {
        const table = new OwidTable([
            ["entityName", "entityCode", "year", "value"],
            ["France", "FRA", 2020, 30],
            ["France", "FRA", 2019, 10],
            ["France", "FRA", 2021, 20],
        ])

        const csv = table.toPrettyCsv({ sortBy: ["year"] })
        const lines = csv.split("\n")
        expect(lines[1]).toContain("2019")
        expect(lines[2]).toContain("2020")
        expect(lines[3]).toContain("2021")
    })

    it("handles empty tables gracefully", () => {
        const table = new OwidTable([
            ["entityName", "entityCode", "year", "gdp"],
        ])

        // Should not throw when exporting an empty table
        expect(() => table.toPrettyCsv()).not.toThrow()
        const csv = table.toPrettyCsv()

        // Empty tables produce minimal output (no headers, no data)
        expect(csv.trim()).toBe("")
    })
})
