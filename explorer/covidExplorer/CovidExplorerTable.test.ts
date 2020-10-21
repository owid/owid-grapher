#! /usr/bin/env yarn jest

import { CovidExplorerTable } from "./CovidExplorerTable"
import {
    allAvailableQueryStringCombos,
    CovidQueryParams,
} from "explorer/covidExplorer/CovidParams"
import { queryParamsToStr } from "utils/client/url"
import { sampleMegaCsv } from "./CovidExplorerUtils"
import { MegaCsvToCovidExplorerTable } from "./MegaCsv"
import { flatten } from "grapher/utils/Util"
import { InvalidCell } from "coreTable/InvalidCells"

const table = MegaCsvToCovidExplorerTable(sampleMegaCsv)

it("correctly parses data from mega file", () => {
    expect(table.rows[0].total_cases).toEqual(2)
})

it("correctly computes makeCountryOptions", () => {
    expect(table.availableEntityNames[3]).toEqual("World")
})

it("correctly groups continents and adds rows for each", () => {
    const regionRows = table.where({ entityName: "North America" })
    expect(regionRows.numRows).toEqual(6)
    expect(regionRows.lastRow?.total_cases).toEqual(46451)
})

it("correctly adds EU aggregates and drops last day", () => {
    const regionRows = table.where({ entityName: "European Union" })
    expect(regionRows.numRows).toEqual(1)
})

describe("build covid column", () => {
    let table = MegaCsvToCovidExplorerTable(sampleMegaCsv)
    const def = table.makeRollingAverageColumnDef(
        { slug: "totalCasesSmoothed" },
        (row) => row.total_cases,
        3
    )

    table = table.appendColumns([def])

    it("correctly builds a grapher variable", () => {
        expect(table.rows[3].totalCasesSmoothed).toEqual(14.5)
    })

    it("correctly builds a days since variable", () => {
        const def = table.makeDaysSinceColumnDef(
            "daysSince",
            "totalCasesSmoothed",
            5,
            "Some title"
        )
        const newTable = table.appendColumns([def])
        const slug = def.slug
        expect(newTable.rows[2][slug]).toEqual(0)
        expect(newTable.rows[3][slug]).toEqual(1)
    })

    const rows = []
    for (let index = 0; index < 30; index++) {
        rows.push({
            entityName: "USA",
            cases: index < 15 ? 10 : 20,
            time: index,
        })
    }

    let table2 = new CovidExplorerTable(rows as any)
    const def2 = table2.makeRollingAverageColumnDef(
        { slug: "weeklyCases" },
        (row) => row.cases,
        7,
        true
    )
    table2 = table2.appendColumns([def2])

    it("correctly builds weekly average", () => {
        expect(table2.rows[3].weeklyCases).toEqual(70)
    })

    it("correctly builds weekly change", () => {
        const def3 = table2.makeRollingAverageColumnDef(
            { slug: "weeklyChange" },
            (row) => row.cases,
            7,
            true,
            true
        )
        table2 = table2.appendColumns([def3])

        expect(table2.rows[8].weeklyChange).toEqual(0)
        expect(table2.rows[21].weeklyChange).toEqual(100)
        expect(table2.rows[3].weeklyChange).toBeInstanceOf(InvalidCell)
    })

    it("never creates nulls or undefineds", () => {
        expect(
            table2
                .toOneDimensionalArray()
                .filter((item) => item === null || item === undefined).length
        ).toBe(0)
    })
})

it("can build all columns", () => {
    let table = MegaCsvToCovidExplorerTable(sampleMegaCsv)
    allAvailableQueryStringCombos().forEach((combo) => {
        const count = table.numColumns
        const defs = table.makeColumnDefsFromParams(
            new CovidQueryParams(combo).toConstrainedParams()
        )
        table = table.appendColumnsIfNew(defs)
        expect(table.numColumns).toBeGreaterThanOrEqual(count)
    })
})

describe("builds aligned tests column", () => {
    let table = MegaCsvToCovidExplorerTable(sampleMegaCsv)

    expect(table.columnSlugs.includes("tests-daily")).toEqual(false)

    const params = new CovidQueryParams("testsMetric=true&dailyFreq=true")
    const def = table.makeTestingColumnDef(params.toConstrainedParams())
    table = table.appendColumns([def!])

    expect(table.columnSlugs.includes("tests-daily")).toEqual(true)

    const newParams = new CovidQueryParams(params.toString())
    newParams.perCapita = true
    const def2 = table.makeTestingColumnDef(newParams.toConstrainedParams())
    table = table.appendColumns([def2!])

    expect(table.columnSlugs.includes("tests-perThousand-daily")).toEqual(true)

    it("rows are immutable", () => {
        const table3 = MegaCsvToCovidExplorerTable(sampleMegaCsv)
        expect(table3.columnSlugs.includes("tests-perThousand-daily")).toEqual(
            false
        )
    })

    const params3 = new CovidQueryParams(
        queryParamsToStr({
            aligned: "true",
            perCapita: "true",
            testsMetric: "true",
            totalFreq: "true",
        })
    )

    table = table.appendColumnsIfNew(
        table.makeColumnDefsFromParams(params3.toConstrainedParams())
    )

    expect(table.columnSlugs.includes("deaths-perMil-total")).toEqual(true)
})

it("can filter rows without continent", () => {
    let table = MegaCsvToCovidExplorerTable(sampleMegaCsv)
    expect(table.availableEntityNameSet.has("World")).toBeTruthy()

    table = table.filterGroups()
    expect(table.availableEntityNameSet.has("World")).toBeFalsy()

    table.mainTable.selectEntity("World")
    table = table.mainTable.filterGroups()
    expect(table.availableEntityNameSet.has("World")).toBeTruthy()

    table.mainTable.deselectEntity("World")
    table = table.mainTable.filterGroups()
    expect(table.availableEntityNameSet.has("World")).toBeFalsy()

    table.mainTable.setSelectedEntities(["World"])
    table = table.mainTable.filterGroups()
    expect(table.availableEntityNameSet.has("World")).toBeTruthy()
})
