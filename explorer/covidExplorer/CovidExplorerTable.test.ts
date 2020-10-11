#! /usr/bin/env yarn jest

import { CovidExplorerTable } from "./CovidExplorerTable"
import { CovidQueryParams } from "explorer/covidExplorer/CovidParams"
import { queryParamsToStr } from "utils/client/url"
import { sampleCovidRows } from "./CovidExplorerUtils"

describe("parse row", () => {
    it("correctly parses data from mega file", () => {
        expect(sampleCovidRows[0].total_cases).toEqual(2)
    })
})

describe("makeCountryOptions", () => {
    it("correctly computes options", () => {
        const table = new CovidExplorerTable(sampleCovidRows)
        expect(table.availableEntityNames[2]).toEqual("World")
    })
})

describe("build covid column", () => {
    let table = new CovidExplorerTable(sampleCovidRows)
    table = table.withRollingAverageColumn(
        { slug: "totalCasesSmoothed" },
        (row) => row.total_cases,
        3
    )

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
        const newTable = table.withColumns([def])
        const slug = newTable.lastColumnSlug
        expect(newTable.rows[2][slug]).toEqual(0)
        expect(newTable.rows[3][slug]).toEqual(1)
    })

    const rows = []
    for (let index = 0; index < 30; index++) {
        rows.push({
            entityName: "USA",
            cases: index < 15 ? 10 : 20,
            day: index,
        })
    }

    let table2 = new CovidExplorerTable(rows as any)
    table2 = table2.withRollingAverageColumn(
        { slug: "weeklyCases" },
        (row) => row.cases,
        7,
        true
    )

    it("correctly builds weekly average", () => {
        expect(table2.rows[3].weeklyCases).toEqual(70)
    })

    it("correctly builds weekly change", () => {
        table2 = table2.withRollingAverageColumn(
            { slug: "weeklyChange" },
            (row) => row.cases,
            7,
            true,
            true
        )

        expect(table2.rows[3].weeklyChange).toEqual(undefined)
        expect(table2.rows[8].weeklyChange).toEqual(0)
        expect(table2.rows[21].weeklyChange).toEqual(100)
    })
})

describe("builds aligned tests column", () => {
    let table = new CovidExplorerTable(sampleCovidRows)

    it("it has testing data", () => {
        expect(table.columnSlugs.includes("tests-daily")).toEqual(false)

        const params = new CovidQueryParams("testsMetric=true&dailyFreq=true")
        table = table.withTestingColumn(params.toConstrainedParams())

        expect(table.columnSlugs.includes("tests-daily")).toEqual(true)

        const newParams = new CovidQueryParams(params.toString())
        newParams.perCapita = true
        table = table.withTestingColumn(newParams.toConstrainedParams())

        expect(table.columnSlugs.includes("tests-perThousand-daily")).toEqual(
            true
        )

        const params3 = new CovidQueryParams(
            queryParamsToStr({
                aligned: "true",
                perCapita: "true",
                testsMetric: "true",
                totalFreq: "true",
            })
        )

        table = table.withRequestedColumns(params3.toConstrainedParams())

        expect(table.columnSlugs.includes("deaths-perMil-total")).toEqual(true)
    })

    const table3 = new CovidExplorerTable(sampleCovidRows)
    it("rows are immutable", () => {
        expect(table3.columnSlugs.includes("tests-perThousand-daily")).toEqual(
            false
        )
    })
})

describe("do not include unselected groups in aligned charts", () => {
    it("can filter rows without continent", () => {
        let table = new CovidExplorerTable(sampleCovidRows)
        expect(table.availableEntityNameSet.has("World")).toBeTruthy()

        table = table.filterGroups()
        expect(table.availableEntityNameSet.has("World")).toBeFalsy()

        table.rootTable.selectEntity("World")
        table = (table.rootTable as CovidExplorerTable).filterGroups()
        expect(table.availableEntityNameSet.has("World")).toBeTruthy()

        table.rootTable.deselectEntity("World")
        table = (table.rootTable as CovidExplorerTable).filterGroups()
        expect(table.availableEntityNameSet.has("World")).toBeFalsy()

        table.rootTable.setSelectedEntities(["World"])
        table = (table.rootTable as CovidExplorerTable).filterGroups()
        expect(table.availableEntityNameSet.has("World")).toBeTruthy()
    })
})
