#! /usr/bin/env yarn jest
import {
    SampleColumnSlugs,
    SynthesizeFruitTable,
    SynthesizeGDPTable,
} from "coreTable/OwidTableSynthesizers"
import { OwidTable } from "coreTable/OwidTable"
import { flatten } from "grapher/utils/Util"
import { ColumnTypeNames } from "./CoreTableConstants"
import { LegacyVariablesAndEntityKey } from "./LegacyVariableCode"

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

it("can load a table from an array of arrays", () => {
    const matrix = [
        Object.keys(sampleRows[0]),
        Object.values(sampleRows[0]),
    ] as any[][]
    const table = OwidTable.fromMatrix(matrix)
    expect(table.numRows).toEqual(1)
    expect(table.numColumns).toEqual(6)
    expect(table.toMatrix()).toEqual(matrix)

    const tableTrim = OwidTable.fromMatrix([
        ["country", null],
        ["usa", undefined],
    ])
    expect(tableTrim.toMatrix()).toEqual([["country"], ["usa"]])
})

it("can create a new table by adding a column", () => {
    const table = new OwidTable(sampleRows, [
        {
            slug: "populationInMillions",
            fn: (row) => row.population / 1000000,
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
                sourceId: 2174,
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
                },
            },
        },
        entityKey: {
            45: { name: "Cape Verde", code: "CPV" },
            99: { name: "Papua New Guinea", code: "PNG" },
            204: { name: "Kiribati", code: "KIR" },
        },
    } as any
}

describe("creating a table from legacy", () => {
    const table = OwidTable.fromLegacy(getLegacyVarSet(), {
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

        expect(table.get("3512")?.displayName).toBe("Some Display Name")
    })

    it("can apply legacy unit conversion factors", () => {
        const varSet = getLegacyVarSet()
        varSet.variables["3512"].display!.conversionFactor = 100
        expect(OwidTable.fromLegacy(varSet).get("3512")!.parsedValues).toEqual([
            550,
            420,
            1260,
        ])
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

it("can perfrom queries needed by discrete bar", () => {
    const table = SynthesizeGDPTable(
        {
            entityCount: 3,
            timeRange: [2000, 2004],
        },
        10
    )
    expect(table.rowsByEntityName.size).toEqual(3)
    expect(table.numSelectedEntities).toEqual(0)

    table.selectAll()

    expect(table.numSelectedEntities).toEqual(3)
    expect(table.getClosestRowForEachSelectedEntity(2003, 0).length).toEqual(3)
    expect(table.getClosestRowForEachSelectedEntity(2004, 1).length).toEqual(3)
    expect(table.getClosestRowForEachSelectedEntity(2005, 1).length).toEqual(0)
})

it("can parse data to Javascript data structures", () => {
    const table = SynthesizeGDPTable({
        timeRange: [2000, 2010],
    })

    const parsed = table.get("Population")!.parsedValues
    expect(parsed.filter((item) => isNaN(item))).toEqual([])

    table.get("Population")!.owidRows.forEach((row) => {
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
    expect(table.get(SampleColumnSlugs.GDP)!.rowsWithValue.length).toBe(10)
    expect(
        table
            .dropRandomCells(7, [SampleColumnSlugs.GDP])
            .get(SampleColumnSlugs.GDP)!.rowsWithValue.length
    ).toBe(3)
})

it("can group data by entity and time", () => {
    const table = SynthesizeGDPTable({
        timeRange: [2000, 2010],
        entityCount: 5,
    })

    const timeValues = flatten(
        Array.from(
            table.get("Population")!.valueByEntityNameAndTime.values()
        ).map((value) => Array.from(value.values()))
    )

    expect(timeValues.length).toEqual(50)
    expect(timeValues.filter((value) => isNaN(value as number))).toEqual([])
})

it("prefers a day column when both year and day are in the chart", () => {
    const csv = `entityName,entityCode,entityId,pop,year,day
usa,usa,1,322,2000,2`

    const table = OwidTable.fromDelimited(csv)
    expect(table.timeColumn!.slug).toBe("day")
})

it("can synth numerics", () => {
    const table = SynthesizeGDPTable({
        timeRange: [2000, 2001],
        entityCount: 1,
    })

    const row = table.get("GDP")!.owidRows[0]
    expect(typeof row.value).toEqual("number")
})

const basicTableCsv = `entityName,entityCode,entityId,gdp,pop
iceland,ice,1,123,3
usa,us,2,23,
france,fr,3,23,4`

it("can get entities with required columns", () => {
    const table = OwidTable.fromDelimited(basicTableCsv)
    expect(table.get("pop")?.spec.type).toEqual(ColumnTypeNames.Numeric)
    expect(table.get("pop")?.entityNamesUniqArr.length).toEqual(2)
    expect(table.entitiesWith(["gdp"]).size).toEqual(3)
    expect(table.entitiesWith(["gdp", "pop"]).size).toEqual(2)
})

it("can export a clean csv", () => {
    const table = OwidTable.fromDelimited(basicTableCsv)
    expect(table.toPrettyCsv()).toEqual(`Entity,Code,gdp,pop
france,fr,23,4
iceland,ice,123,3
usa,us,23,`)
})

it("can handle columns with commas", () => {
    const table = OwidTable.fromDelimited(basicTableCsv)
    table.get("gdp")!.spec.name = "Gross, Domestic, Product"
    expect(table.toPrettyCsv())
        .toEqual(`Entity,Code,"Gross, Domestic, Product",pop
france,fr,23,4
iceland,ice,123,3
usa,us,23,`)
})

describe("time filtering", () => {
    it("can filter by time domain", () => {
        const table = SynthesizeGDPTable({
            entityCount: 2,
            timeRange: [2000, 2005],
        })

        expect(table.numRows).toBe(10)
        expect(table.filterByTime(2000, 2003).numRows).toBe(8)
        expect(table.filterByTime(2000, 2000).numRows).toBe(2)
    })

    it("can get time options", () => {
        const table = SynthesizeGDPTable({
            entityCount: 2,
            timeRange: [2000, 2003],
        })

        const timeOptions = table.getTimeOptionsForColumns([
            SampleColumnSlugs.GDP,
        ])
        expect(timeOptions).toEqual([2000, 2001, 2002])
    })

    it("can handle infinity when filtering", () => {
        const table = SynthesizeGDPTable({
            entityCount: 2,
            timeRange: [2000, 2005],
        })

        expect(table.numRows).toBe(10)
        expect(table.filterByTime(Infinity, Infinity).numRows).toBe(2)
        expect(table.filterByTime(-Infinity, -Infinity).numRows).toBe(2)
        expect(table.filterByTime(-Infinity, Infinity).numRows).toBe(10)
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
        expect(table.filterByTargetTime(2010, 2).numRows).toBe(0)
        expect(table.filterByTargetTime(2010, 20).numRows).toBe(2)

        expect(
            table
                .selectEntity(table.availableEntityNames[0])
                .filterBySelectedOnly()
                .filterByTargetTime(2010, 20).numRows
        ).toBe(1)

        const table2 = SynthesizeGDPTable({
            entityCount: 1,
            timeRange: [2000, 2001],
        })

        expect(table2.filterByTargetTime(2000, 1).numRows).toBe(1)
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
        const newTable = table.withColumns([
            {
                slug: "populationInMillions",
                fn: (row) => row.population / 1000000,
            },
        ])
        expect(newTable.rows[0].populationInMillions).toEqual(300)
        expect(newTable.numColumns).toEqual(colLength + 1)
    })

    // sortedUniqNonEmptyStringVals
    it("can get values for color legend", () => {
        expect(
            table.get("continent")?.sortedUniqNonEmptyStringVals.length
        ).toEqual(1)
    })
})

describe("relative mode", () => {
    // 2 columns. 2 countries. 2 years
    let table = SynthesizeFruitTable({
        entityCount: 2,
        timeRange: [2000, 2002],
    })

    let firstRow = table.rows[0]
    expect(firstRow.Fruit).toBeGreaterThan(400)
    table = table.toPercentageFromEachColumnForEachEntityAndTime([
        "Fruit",
        "Vegetables",
    ])
    firstRow = table.rows[0]
    expect(Math.round(firstRow.Fruit + firstRow.Vegetables)).toEqual(100)
})
