#! /usr/bin/env yarn jest

import { OwidTable, BasicTable } from "charts/owidData/OwidTable"
import { readVariable, readVariableSet } from "test/fixtures"

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
            entityName: "United States",
            population: 3e8,
            entityId: 1,
            entityCode: "USA"
        }
    ]
    const table = new OwidTable(rows)
    it("can create a table and detect columns", () => {
        expect(table.rows.length).toEqual(1)
        expect(Array.from(table.columnsByName.keys()).length).toEqual(5)
    })

    it("a column can be added", () => {
        table.addComputedColumn({
            slug: "populationInMillions",
            fn: row => row.population / 1000000
        })
        expect(table.rows[0].populationInMillions).toEqual(300)
    })
})

describe("from legacy", () => {
    const varId = 3512
    const varSet = readVariable(varId)
    const table = OwidTable.fromLegacy(varSet)
    const name =
        "Prevalence of wasting, weight for height (% of children under 5)"
    it("can create a table and detect columns from legacy", () => {
        expect(table.rows.length).toEqual(805)
        expect(Array.from(table.columnsByName.keys())).toEqual([
            "entityName",
            "entityId",
            "entityCode",
            "year",
            name
        ])
    })
})

describe("annotations column", () => {
    const csv = `entityName,pop,notes,year
usa,322,in hundreds of millions,2000
hi,1,in millions,2000
hi,1,,2001`
    const specs = new Map()
    const table = BasicTable.fromCsv(csv)
    table.addStringColumnSpec({ slug: "pop", annotationsColumnSlug: "notes" })

    it("can get annotations for a row", () => {
        const annotationsColumn = table.columnsBySlug.get("pop")
            ?.annotationsColumn
        expect(annotationsColumn?.spec.slug).toBe("notes")

        const entityNameMap = annotationsColumn?.entityNameMap!

        expect(entityNameMap.size).toEqual(2)
        expect(entityNameMap.get("hi")).toContain("in millions")
        expect(entityNameMap.get("usa")).toContain("in hundreds of millions")
    })
})

describe("from csv", () => {
    const csv = `country,population
iceland,1
france,50
usa,300
canada,20`
    const table = BasicTable.fromCsv(csv)

    it("a table can be made from csv", () => {
        expect(table.rows.length).toEqual(4)
        expect(Array.from(table.columnsByName.keys())).toEqual([
            "country",
            "population"
        ])
    })

    describe("filtering", () => {
        const col = table.columnsBySlug.get("country")!
        it("one filter works", () => {
            expect(col.values[3]).toEqual("canada")
            table.addFilterColumn(
                "pop_filter",
                row => parseInt(row.population) > 40
            )
            expect(col?.values[0]).toEqual("france")
            expect(col?.values[1]).toEqual("usa")
        })

        it("multiple filters work", () => {
            table.addFilterColumn("name_filter", row =>
                (row.country as string).startsWith("u")
            )
            expect(col?.values[0]).toEqual("usa")
            expect(col?.values[1]).toEqual(undefined)
        })

        it("adding rows works with filters", () => {
            table.addRowsAndDetectColumns([
                { country: "ireland", population: "7" },
                { country: "united kingdom", population: "60" }
            ])
            expect(col?.values[0]).toEqual("usa")
            expect(col?.values[1]).toEqual("united kingdom")
        })
    })
})

describe("toDelimited", () => {
    const csv = `country,Population in 2020
iceland,1`
    const table = BasicTable.fromCsv(csv)
    it("delimited uses slugs as default", () => {
        const csv = table.toDelimited()
        expect(csv).toEqual(`country,Population-in-2020
iceland,1`)
    })
})

describe("immutability", () => {
    const csv = `country,Population in 2020
iceland,1`
    const rows = [{ country: "USA" }, { country: "Germany" }]
    const table = new BasicTable(rows)
    it("does not modify rows", () => {
        table.addComputedColumn({
            slug: "firstLetter",
            fn: row => row.country.substr(0, 1)
        })
        expect(table.columnsBySlug.get("firstLetter")?.values.join("")).toEqual(
            `UG`
        )
        expect((rows[0] as any).firstLetter).toEqual(undefined)
    })
})

describe("rolling averages", () => {
    const rows = [
        {
            year: 2020,
            entityName: "United States",
            population: 3e8,
            entityId: 1,
            entityCode: "USA",
            continent: "North America"
        },
        {
            year: 2020,
            entityName: "World",
            population: 10e8,
            entityId: 12,
            entityCode: "World",
            continent: ""
        },
        {
            year: 2020,
            entityName: "United States",
            population: 3e8,
            entityId: 1,
            entityCode: "USA",
            continent: "North America"
        }
    ]
    const colLength = Object.keys(rows[0]).length
    const table = new OwidTable(rows)
    it("a column can be added", () => {
        expect(table.rows.length).toEqual(rows.length)
        expect(Array.from(table.columnsByName.keys()).length).toEqual(colLength)
        table.addComputedColumn({
            slug: "populationInMillions",
            fn: row => row.population / 1000000
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
