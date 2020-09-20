#! /usr/bin/env yarn jest

import { OwidTable, BasicTable, SynthesizeOwidTable } from "owidTable/OwidTable"
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
        table.addNumericComputedColumn({
            slug: "populationInMillions",
            fn: (row) => row.population / 1000000,
        })
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
    const table = new OwidTable([]).loadFromLegacy(getLegacyVarSet())
    const name =
        "Prevalence of wasting, weight for height (% of children under 5)"

    it("can create a table and detect columns from legacy", () => {
        expect(table.rows.length).toEqual(3)
        expect(Array.from(table.columnsBySlug.keys())).toEqual([
            "entityName",
            "entityId",
            "entityCode",
            "year",
            "3512",
        ])

        expect(Array.from(table.columnsByName.keys())).toEqual([
            "Entity",
            "entityId",
            "Code",
            "Year",
            name,
        ])

        expect(table.columnsByOwidVarId.get(3512)?.displayName).toBe(
            "Some Display Name"
        )
    })

    it("can apply legacy unit conversion factors", () => {
        const varSet = getLegacyVarSet()
        const table = new OwidTable([]).loadFromLegacy(varSet)
        table.applyUnitConversionAndOverwriteLegacyColumn(100, 3512)
        expect(table.columnsBySlug.get("3512")!.parsedValues).toEqual([
            550,
            420,
            1260,
        ])
    })
})

describe("can query the data", () => {
    it("can do a query used by discrete bar", () => {
        const table = SynthesizeOwidTable(
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

    it("is all integers", () => {
        const table = BasicTable.fromDelimited(`gdp,perCapita
123,123.1`)
        expect(table.get("gdp")?.isAllIntegers).toBeTruthy()
        expect(table.get("perCapita")?.isAllIntegers).toBeFalsy()
    })
})

describe("annotations column", () => {
    const csv = `entityName,pop,notes,year
usa,322,in hundreds of millions,2000
hi,1,in millions,2000
hi,1,,2001`
    const table = BasicTable.fromDelimited(csv)
    table.addStringColumnSpec({ slug: "pop", annotationsColumnSlug: "notes" })

    it("can get annotations for a row", () => {
        const annotationsColumn = table.columnsBySlug.get("pop")
            ?.annotationsColumn
        expect(annotationsColumn?.spec.slug).toBe("notes")

        const entityNameMap = annotationsColumn!.entityNameMap

        expect(entityNameMap.size).toEqual(2)
        expect(entityNameMap.get("hi")).toContain("in millions")
        expect(entityNameMap.get("usa")).toContain("in hundreds of millions")
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
        const table = SynthesizeOwidTable({
            timeRange: [2000, 2001],
            countryCount: 1,
        })

        const row = table.get("GDP")!.owidRows[0]
        expect(typeof row.value).toEqual("number")
    })
})

describe("from csv", () => {
    const csv = `country,population
iceland,1
france,50
usa,300
canada,20`
    const table = BasicTable.fromDelimited(csv)

    it("a table can be made from csv", () => {
        expect(table.rows.length).toEqual(4)
        expect(Array.from(table.columnsByName.keys())).toEqual([
            "country",
            "population",
        ])
    })

    describe("filtering", () => {
        const col = table.columnsBySlug.get("country")!
        it("one filter works", () => {
            expect(col.parsedValues[3]).toEqual("canada")
            table.addFilterColumn(
                "pop_filter",
                (row) => parseInt(row.population) > 40
            )
            expect(col?.parsedValues[0]).toEqual("france")
            expect(col?.parsedValues[1]).toEqual("usa")
        })

        it("multiple filters work", () => {
            table.addFilterColumn("name_filter", (row) =>
                (row.country as string).startsWith("u")
            )
            expect(col?.parsedValues[0]).toEqual("usa")
            expect(col?.parsedValues[1]).toEqual(undefined)
        })

        it("adding rows works with filters", () => {
            table.cloneAndAddRowsAndDetectColumns([
                { country: "ireland", population: "7" },
                { country: "united kingdom", population: "60" },
            ])
            expect(col?.parsedValues[0]).toEqual("usa")
            expect(col?.parsedValues[1]).toEqual("united kingdom")
        })
    })
})

describe("toDelimited", () => {
    const csv = `country,Population in 2020
iceland,1`
    const table = BasicTable.fromDelimited(csv)
    it("delimited uses slugs as default", () => {
        const csv = table.toDelimited()
        expect(csv).toEqual(`country,Population-in-2020
iceland,1`)
        expect(table.get("country")!.isEmpty).toBe(false)
    })
})

describe("immutability", () => {
    const rows = [{ country: "USA" }, { country: "Germany" }]
    const table = new BasicTable(rows)
    it("does not modify rows", () => {
        table.addNumericComputedColumn({
            slug: "firstLetter",
            fn: (row) => row.country.length,
        })
        expect(
            table.columnsBySlug.get("firstLetter")?.parsedValues.join("")
        ).toEqual(`37`)
        expect((rows[0] as any).firstLetter).toEqual(undefined)
    })
})

const basicTableCsv = `entityName,entityCode,entityId,gdp,pop
iceland,ice,1,123,3
usa,us,2,23,
france,fr,3,23,4`

describe("can get entities with all required columns", () => {
    const table = OwidTable.fromDelimited(basicTableCsv)

    it("gets entities only with values for that column", () => {
        expect(table.columnsBySlug.get("pop")?.entityNamesUniq.size).toEqual(2)
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

    it("can export a clean csv with dates", () => {
        const table = new BasicTable(
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

        expect(table.toView().toPrettyCsv()).toEqual(`entityName,day,annotation
Aruba,2020-01-22,"Something, foo"
Canada,2020-01-23,`)
    })

    it("can handle columns with commas", () => {
        const table = OwidTable.fromDelimited(basicTableCsv)
        table.columnsBySlug.get("gdp")!.spec.name = "Gross, Domestic, Product"
        expect(table.toView().toPrettyCsv())
            .toEqual(`Entity,Code,"Gross, Domestic, Product",pop
france,fr,23,4
iceland,ice,123,3
usa,us,23,`)
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
        table.addNumericComputedColumn({
            slug: "populationInMillions",
            fn: (row) => row.population / 1000000,
        })
        expect(table.rows[0].populationInMillions).toEqual(300)
        expect(Array.from(table.columnsByName.keys()).length).toEqual(
            colLength + 1
        )
    })

    // sortedUniqNonEmptyStringVals
    it("cam get values for color legend", () => {
        expect(
            table.columnsBySlug.get("continent")?.sortedUniqNonEmptyStringVals
                .length
        ).toEqual(1)
    })
})
