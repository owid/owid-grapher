#! /usr/bin/env yarn jest
import {
    OwidTable,
    SynthesizeFruitTable,
    SynthesizeGDPTable,
    SynthesizeOwidTable,
} from "coreTable/OwidTable"
import { flatten, getRandomNumberGenerator } from "grapher/utils/Util"
import { ColumnTypeNames } from "./CoreTableConstants"
import { LegacyVariablesAndEntityKey } from "./LegacyVariableCode"

describe(OwidTable, () => {
    // Scenarios
    // create: rows|noRows & noSpec|fullSpec|partialSpec|incorrectSpec?
    //  add: rows
    //  add: spec
    //  add: spec with rowGen
    //  add: partialSpec
    //  add partialSpec with rowGen
    //  change spec?

    const rows = [
        {
            year: 2020,
            time: 2020,
            entityName: "United States",
            population: 3e8,
            entityId: 1,
            entityCode: "USA",
        },
    ]
    const table = new OwidTable(rows)
    it("can create a table and detect columns", () => {
        expect(table.rows.length).toEqual(1)
        expect(Array.from(table.columnsByName.keys()).length).toEqual(6)
    })

    it("a column can be added", () => {
        const table = new OwidTable(rows, [
            {
                slug: "populationInMillions",
                fn: (row) => row.population / 1000000,
            },
        ])
        expect(table.rows[0].populationInMillions).toEqual(300)
    })
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

describe("from legacy", () => {
    const table = OwidTable.fromLegacy(getLegacyVarSet())
    const name =
        "Prevalence of wasting, weight for height (% of children under 5)"

    it("can create a table and detect columns from legacy", () => {
        expect(table.rows.length).toEqual(3)
        expect(table.columnSlugs).toEqual([
            "entityName",
            "entityId",
            "entityCode",
            "year",
            "3512",
            "time", // todo: what is the best design here?
        ])

        expect(Array.from(table.columnsByName.keys())).toEqual([
            "Entity",
            "entityId",
            "Code",
            "Year",
            name,
            "time",
        ])

        expect(table.columnsByOwidVarId.get(3512)?.displayName).toBe(
            "Some Display Name"
        )
    })

    it("can apply legacy unit conversion factors", () => {
        const varSet = getLegacyVarSet()
        varSet.variables["3512"].display!.conversionFactor = 100
        const table = OwidTable.fromLegacy(varSet)
        expect(table.get("3512")!.parsedValues).toEqual([550, 420, 1260])
    })
})

describe("can query the data", () => {
    it("can do a query used by discrete bar", () => {
        const table = SynthesizeGDPTable(
            {
                countryCount: 3,
                timeRange: [2000, 2004],
            },
            10
        )
        expect(table.rowsByEntityName.size).toEqual(3)
        expect(table.selectedEntityNames.length).toEqual(0)

        table.selectAll()

        expect(table.selectedEntityNames.length).toEqual(3)
        expect(
            table.getClosestRowForEachSelectedEntity(2003, 0).length
        ).toEqual(3)
        expect(
            table.getClosestRowForEachSelectedEntity(2004, 1).length
        ).toEqual(3)
        expect(
            table.getClosestRowForEachSelectedEntity(2005, 1).length
        ).toEqual(0)
    })

    const table = SynthesizeGDPTable({
        timeRange: [2000, 2010],
        countryCount: 5,
    })

    it("can parse values", () => {
        const parsed = table.get("Population")!.parsedValues
        expect(parsed.filter((item) => isNaN(item))).toEqual([])

        table.get("Population")!.owidRows.forEach((row) => {
            expect(typeof row.entityName).toBe("string")
            expect(row.value).toBeGreaterThan(100)
            expect(row.time).toBeGreaterThan(1999)
        })
    })

    it("can group by entity and time", () => {
        const timeValues = flatten(
            Array.from(
                table.get("Population")!.valueByEntityNameAndTime.values()
            ).map((value) => Array.from(value.values()))
        )

        expect(timeValues.length).toEqual(50)
        expect(timeValues.filter((value) => isNaN(value as number))).toEqual([])
    })
})

describe("when it has both a day and year column, prefer the day column", () => {
    const csv = `entityName,entityCode,entityId,pop,year,day
usa,usa,1,322,2000,2`

    const table = OwidTable.fromDelimited(csv)
    it("prefers a day column when both year and day are in the chart", () => {
        expect(table.timeColumn!.slug).toBe("day")
    })
})

describe("can synth data", () => {
    it("can synth numerics", () => {
        const table = SynthesizeGDPTable({
            timeRange: [2000, 2001],
            countryCount: 1,
        })

        const row = table.get("GDP")!.owidRows[0]
        expect(typeof row.value).toEqual("number")
    })
})

const basicTableCsv = `entityName,entityCode,entityId,gdp,pop
iceland,ice,1,123,3
usa,us,2,23,
france,fr,3,23,4`

describe("can get entities with all required columns", () => {
    const table = OwidTable.fromDelimited(basicTableCsv)

    it("gets entities only with values for that column", () => {
        expect(table.get("pop")?.entityNamesUniq.size).toEqual(2)
    })

    it("filters rows correctly", () => {
        expect(table.entitiesWith(["gdp"]).size).toEqual(3)
    })

    it("filters rows correctly", () => {
        expect(table.entitiesWith(["gdp"]).size).toEqual(3)
        expect(table.entitiesWith(["gdp", "pop"]).size).toEqual(2)
    })
})

describe("csv export", () => {
    it("can export a clean csv", () => {
        const table = OwidTable.fromDelimited(basicTableCsv)
        expect(table.toView().toPrettyCsv()).toEqual(`Entity,Code,gdp,pop
france,fr,23,4
iceland,ice,123,3
usa,us,23,`)
    })

    it("can handle columns with commas", () => {
        const table = OwidTable.fromDelimited(basicTableCsv)
        table.get("gdp")!.spec.name = "Gross, Domestic, Product"
        expect(table.toView().toPrettyCsv())
            .toEqual(`Entity,Code,"Gross, Domestic, Product",pop
france,fr,23,4
iceland,ice,123,3
usa,us,23,`)
    })
})

describe("time filtering", () => {
    it("can filter by time domain", () => {
        const table = SynthesizeGDPTable({
            countryCount: 2,
            timeRange: [2000, 2005],
        })

        expect(table.rows.length).toBe(10)

        expect(table.filterByTime(2000, 2003).rows.length).toBe(8)

        expect(table.filterByTime(2000, 2000).rows.length).toBe(2)
    })

    it("can filter by time target", () => {
        const table = SynthesizeGDPTable(
            {
                countryCount: 2,
                timeRange: [2000, 2005],
            },
            1
        )

        expect(table.rows.length).toBe(10)
        expect(table.filterByTargetTime(2010, 2).rows.length).toBe(0)
        expect(table.filterByTargetTime(2010, 20).rows.length).toBe(2)

        expect(
            table
                .selectEntity(table.availableEntityNames[0])
                .filterBySelectedOnly()
                .filterByTargetTime(2010, 20).rows.length
        ).toBe(1)

        const table2 = SynthesizeGDPTable({
            countryCount: 1,
            timeRange: [2000, 2001],
        })

        expect(table2.filterByTargetTime(2000, 1).rows.length).toBe(1)
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
        expect(table.rows.length).toEqual(rows.length)
        expect(Array.from(table.columnsByName.keys()).length).toEqual(colLength)
        const newTable = table.withColumns([
            {
                slug: "populationInMillions",
                fn: (row) => row.population / 1000000,
            },
        ])
        expect(newTable.rows[0].populationInMillions).toEqual(300)
        expect(Array.from(newTable.columnsByName.keys()).length).toEqual(
            colLength + 1
        )
    })

    // sortedUniqNonEmptyStringVals
    it("cam get values for color legend", () => {
        expect(
            table.get("continent")?.sortedUniqNonEmptyStringVals.length
        ).toEqual(1)
    })
})

describe("relative mode", () => {
    // 2 columns. 2 countries. 2 years
    let table = SynthesizeFruitTable({
        countryCount: 2,
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
