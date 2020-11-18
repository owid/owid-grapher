#! /usr/bin/env yarn jest
import {
    SampleColumnSlugs,
    SynthesizeFruitTable,
    SynthesizeGDPTable,
} from "coreTable/OwidTableSynthesizers"
import { BlankOwidTable, OwidTable } from "coreTable/OwidTable"
import { flatten } from "grapher/utils/Util"
import { ColumnTypeNames } from "./CoreColumnDef"
import { LegacyVariablesAndEntityKey } from "./LegacyVariableCode"
import { ErrorValueTypes } from "./ErrorValues"
import { LegacyGrapherInterface } from "grapher/core/GrapherInterface"
import { DimensionProperty } from "grapher/core/GrapherConstants"

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

it("can create a table and detect columns", () => {
    const table = new OwidTable(sampleRows)
    expect(table.numRows).toEqual(1)
    expect(table.numColumns).toEqual(6)
})

it("can create a new table by adding a column", () => {
    const table = new OwidTable(sampleRows, [
        {
            slug: "populationInMillions",
            values: sampleRows.map((row) => row.population / 1000000),
        },
    ])
    expect(table.rows[0].populationInMillions).toEqual(300)
})

const getLegacyVarSet = (): LegacyVariablesAndEntityKey => {
    return {
        variables: {
            "3512": {
                years: [1983, 1985, 1985],
                entities: [99, 45, 204],
                values: [5.5, 4.2, 12.6],
                id: 3512,
                name:
                    "Prevalence of wasting, weight for height (% of children under 5)",
                unit: "% of children under 5",
                description: "Prevalence of...",
                shortUnit: "%",
                display: {
                    name: "Some Display Name",
                },
                source: {
                    id: 2174,
                    name:
                        "World Bank - WDI: Prevalence of wasting, weight for height (% of children under 5)",
                    link:
                        "http://data.worldbank.org/data-catalog/world-development-indicators",
                } as any,
            },
        },
        entityKey: {
            45: { name: "Cape Verde", code: "CPV", id: 45 },
            99: { name: "Papua New Guinea", code: "PNG", id: 99 },
            204: { name: "Kiribati", code: "KIR", id: 204 },
        },
    }
}

const getLegacyGrapherConfig = (): Partial<LegacyGrapherInterface> => {
    return {
        dimensions: [
            {
                property: DimensionProperty.y,
                variableId: 3512,
            },
        ],
    }
}

describe("creating a table from legacy", () => {
    const table = OwidTable.fromLegacy(getLegacyVarSet(), {
        ...getLegacyGrapherConfig(),
        selectedData: [{ entityId: 45, index: 0, color: "blue" }],
    })
    const name =
        "Prevalence of wasting, weight for height (% of children under 5)"

    it("can create a table and detect columns from legacy", () => {
        expect(table.numRows).toEqual(3)
        expect(table.columnSlugs).toEqual([
            "entityName",
            "entityId",
            "entityCode",
            "entityColor",
            "year",
            "3512",
            "time", // todo: what is the best design here?
        ])

        expect(table.columnNames).toEqual([
            "Entity",
            "entityId",
            "Code",
            "entityColor",
            "Year",
            name,
            "time",
        ])

        expect(table.get("3512").displayName).toBe("Some Display Name")
    })

    it("can apply legacy unit conversion factors", () => {
        const varSet = getLegacyVarSet()
        varSet.variables["3512"].display!.conversionFactor = 100
        expect(
            OwidTable.fromLegacy(varSet, getLegacyGrapherConfig()).get("3512")!
                .values
        ).toEqual([550, 420, 1260])
    })

    it("can apply legacy selection colors", () => {
        expect(table.getColorForEntityName("Cape Verde")).toBe("blue")
        expect(table.getColorForEntityName("Kiribati")).toBe(undefined)
    })

    it("can export legacy to CSV", () => {
        const expected = `Entity,Code,Year,"Prevalence of wasting, weight for height (% of children under 5)"
Cape Verde,CPV,1985,4.2
Kiribati,KIR,1985,12.6
Papua New Guinea,PNG,1983,5.5`
        expect(table.toPrettyCsv()).toEqual(expected)
    })
})

it("can perform queries needed by discrete bar", () => {
    const table = SynthesizeGDPTable(
        {
            entityCount: 3,
            timeRange: [2000, 2004],
        },
        10
    )
    expect(table.rowIndicesByEntityName.size).toEqual(3)
    const entityNames = table.availableEntityNames
    expect(
        table.getClosestIndexForEachEntity(entityNames, 2003, 0).length
    ).toEqual(3)
    expect(
        table.getClosestIndexForEachEntity(entityNames, 2004, 1).length
    ).toEqual(3)
    expect(
        table.getClosestIndexForEachEntity(entityNames, 2005, 1).length
    ).toEqual(0)
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
        expect(row.time).toBeGreaterThan(1999)
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

    const timeValues = flatten(
        Array.from(
            table.get("Population").valueByEntityNameAndTime.values()
        ).map((value) => Array.from(value.values()))
    )

    expect(timeValues.length).toEqual(50)
    expect(timeValues.filter((value) => isNaN(value as number))).toEqual([])
})

it("prefers a day column when both year and day are in the chart", () => {
    const csv = `entityName,entityCode,entityId,pop,year,day
usa,usa,1,322,2000,2`

    const table = new OwidTable(csv)
    expect(table.timeColumn!.slug).toBe("day")
})

it("can get the latest values for an entity", () => {
    const csv = `entityName,entityCode,entityId,pop,year,coal
usa,usa,1,322,2000,10
usa,usa,1,322,2001,
usa,usa,1,4,2002,`

    const table = new OwidTable(csv)
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

const basicTableCsv = `entityName,entityCode,entityId,gdp,pop
iceland,ice,1,123,3
usa,us,2,23,
france,fr,3,23,4`

it("can get entities with required columns", () => {
    const table = new OwidTable(basicTableCsv)
    expect(table.get("pop").def.type).toEqual(ColumnTypeNames.Numeric)
    expect(table.get("pop").uniqEntityNames.length).toEqual(2)
    expect(table.entitiesWith(["gdp"]).size).toEqual(3)
    expect(table.entitiesWith(["gdp", "pop"]).size).toEqual(2)
})

it("can export a clean csv", () => {
    const table = new OwidTable(basicTableCsv)
    expect(table.toPrettyCsv()).toEqual(`Entity,Code,gdp,pop
france,fr,23,4
iceland,ice,123,3
usa,us,23,`)
})

it("can handle columns with commas", () => {
    const table = new OwidTable(basicTableCsv)
    table.get("gdp").def.name = "Gross, Domestic, Product"
    expect(table.toPrettyCsv())
        .toEqual(`Entity,Code,"Gross, Domestic, Product",pop
france,fr,23,4
iceland,ice,123,3
usa,us,23,`)
})

describe("filtering", () => {
    it("can filter by population", () => {
        const table = SynthesizeFruitTable({ timeRange: [2000, 2001] })
        expect(table.filterByPopulationExcept(100).numRows).toEqual(2)
    })

    it("can filter by population on empty table", () => {
        const table = BlankOwidTable()
        expect(
            table.filterByPopulationExcept(1).filterByPopulationExcept(1e12)
                .numRows
        ).toEqual(0)
    })
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
        const csv = `entityName,entityId,entityCode,day,value
usa,1,usa,-4,1
usa,1,usa,1,1
usa,1,usa,-5,1`

        const table = new OwidTable(csv)
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
})

describe("rolling averages", () => {
    const rows = [
        {
            year: 2020,
            time: 2020,
            entityName: "United States",
            population: 3e8,
            entityId: 1,
            entityCode: "USA",
            continent: "North America",
        },
        {
            year: 2020,
            time: 2020,
            entityName: "World",
            population: 10e8,
            entityId: 12,
            entityCode: "World",
            continent: "",
        },
        {
            year: 2020,
            time: 2020,
            entityName: "United States",
            population: 3e8,
            entityId: 1,
            entityCode: "USA",
            continent: "North America",
        },
    ]
    const colLength = Object.keys(rows[0]).length
    const table = new OwidTable(rows)
    it("a column can be added", () => {
        expect(table.numRows).toEqual(rows.length)
        expect(table.numColumns).toEqual(colLength)
        const newTable = table.appendColumns([
            {
                slug: "populationInMillions",
                values: rows.map((row) => row.population / 1000000),
            },
        ])
        expect(newTable.rows[0].populationInMillions).toEqual(300)
        expect(newTable.numColumns).toEqual(colLength + 1)
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
        expect(Math.round(row.Fruit + row.Vegetables)).toEqual(100)
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
        expect(
            table.get(SampleColumnSlugs.Fruit).summary.numErrorValues
        ).toEqual(1)
    })
})

describe("time domain", () => {
    it("can get the time domain across columns", () => {
        const table = new OwidTable(
            `gdp,perCapita,day,entityName,entityId,entityCode
0,123.1,0,usa,,
12,300,1,usa,,
20,,2,usa,,`,
            [
                { slug: "gdp", type: ColumnTypeNames.Numeric },
                { slug: "perCapita", type: ColumnTypeNames.Numeric },
                { slug: "day", type: ColumnTypeNames.Day },
            ]
        )

        expect(table.timeDomainFor(["gdp", "perCapita"])).toEqual([0, 2])
        expect(table.timeDomainFor(["perCapita"])).toEqual([0, 1])
    })

    it("can get minTime and maxTimes when years are initially unsorted", () => {
        const table = new OwidTable(
            `gdp,day,entityName,entityId,entityCode
0,2000,usa,,
12,1950,usa,,
20,1970,usa,,`,
            [
                { slug: "gdp", type: ColumnTypeNames.Numeric },
                { slug: "day", type: ColumnTypeNames.Day },
            ]
        )

        expect(table.get("gdp").minTime).toEqual(1950)
        expect(table.get("gdp").maxTime).toEqual(2000)
        expect(table.get("gdp").uniqTimesAsc).toEqual([1950, 1970, 2000])
    })
})

describe("linear interpolation", () => {
    const table = new OwidTable(
        `gdp,year,entityName
10,2000,france
0,2001,france
,2002,france
,2003,france
8,2005,france
,2006,france
2,2000,uk
3,2004,uk`,
        [
            { slug: "gdp", type: ColumnTypeNames.Numeric },
            { slug: "year", type: ColumnTypeNames.Year },
        ]
    )

    it("applies interpolation", () => {
        const interpolatedTable = table.interpolateColumnLinearly("gdp")

        expect(interpolatedTable.get("gdp").valuesIncludingErrorValues).toEqual(
            [
                // France
                10,
                0,
                2,
                4,
                6,
                8,
                8,
                // UK
                2,
                2.25,
                2.5,
                2.75,
                3,
                3,
                3,
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
            interpolatedTable.rows.filter((row) => isNaN(row.year)).length
        ).toEqual(0)
    })
})

describe("tolerance", () => {
    const table = new OwidTable(
        `gdp,year,entityName,entityId,entityCode
,2000,france,1,
2,2000,uk,2,
0,2001,france,1,
,2002,france,1,
,2003,france,1,
3,2004,uk,2,
1,2005,france,1,
,2006,france,1,`,
        [
            { slug: "gdp", type: ColumnTypeNames.Numeric },
            { slug: "year", type: ColumnTypeNames.Year },
        ]
    )

    function applyTolerance(table: OwidTable) {
        return table.interpolateColumnWithTolerance("gdp", 1)
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
            toleranceTable.rows.filter((row) => isNaN(row.year)).length
        ).toEqual(0)
    })

    it("tolerance application is idempotent", () => {
        expect(applyTolerance(table).rows).toEqual(
            applyTolerance(applyTolerance(table)).rows
        )
    })

    it("doesn't leak between entities", () => {
        const table = new OwidTable(
            `gdp,year,entityName,entityId,entityCode
,2000,france,1,
,2000,germany,1,
,2001,germany,1,
3,2000,uk,2,
,2001,uk,2,`,
            [
                { slug: "gdp", type: ColumnTypeNames.Numeric },
                { slug: "year", type: ColumnTypeNames.Year },
            ]
        )
        const toleranceTable = table.interpolateColumnWithTolerance("gdp", 1)
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

it("assigns originalTime as 'time' in owidRows", () => {
    const csv = `gdp,year,entityName,entityId,entityCode
1000,2019,USA,,
1001,2020,UK,,`
    const table = new OwidTable(csv).interpolateColumnWithTolerance("gdp", 1)
    const owidRows = table.get("gdp").owidRows
    expect(owidRows).toEqual(
        expect.not.arrayContaining([
            expect.objectContaining({
                entityName: "USA",
                time: 2020,
                value: 1000,
            }),
        ])
    )
    expect(owidRows).toEqual(
        expect.not.arrayContaining([
            expect.objectContaining({
                entityName: "UK",
                time: 2019,
                value: 1001,
            }),
        ])
    )
})
