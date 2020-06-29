#! /usr/bin/env yarn jest

import { OwidTable, BasicTable } from "charts/owidData/OwidTable"
import { readVariable, readVariableSet } from "test/fixtures"
import { slugify } from "charts/Util"

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
        expect(csv).toEqual(`country,population-in-2020
iceland,1`)
    })
})

describe("rolling averages", () => {
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
    it("a column can be added", () => {
        expect(table.rows.length).toEqual(1)
        expect(Array.from(table.columnsByName.keys()).length).toEqual(5)
        table.addComputedColumn({
            slug: "populationInMillions",
            fn: row => row.population / 1000000
        })
        expect(table.rows[0].populationInMillions).toEqual(300)
        expect(Array.from(table.columnsByName.keys()).length).toEqual(6)
    })
})
