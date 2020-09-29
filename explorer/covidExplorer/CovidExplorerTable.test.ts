#! /usr/bin/env yarn jest

import { getLeastUsedColor, CovidExplorerTable } from "./CovidExplorerTable"
import { covidSampleRows } from "./CovidSampleRows"
import uniq from "lodash/uniq"
import { CovidQueryParams } from "explorer/covidExplorer/CovidParams"
import { queryParamsToStr } from "utils/client/url"

describe("parse row", () => {
    it("correctly parses data from mega file", () => {
        expect(covidSampleRows[0].total_cases).toEqual(2)
    })
})

describe("makeCountryOptions", () => {
    it("correctly computes options", () => {
        const table = new CovidExplorerTable(covidSampleRows)
        expect(table.availableEntityNames[2]).toEqual("World")
    })
})

describe("generateContinentRows", () => {
    it("correctly groups continents and adds rows for each", () => {
        const regionRows = CovidExplorerTable.generateContinentRows(
            covidSampleRows
        )
        expect(regionRows.length).toEqual(6)
        expect(regionRows[regionRows.length - 1].total_cases).toEqual(46451)
    })
})

describe("build covid column", () => {
    let table = new CovidExplorerTable(covidSampleRows)
    table = table.withRollingAverageColumn(
        { slug: "totalCasesSmoothed" },
        3,
        (row) => row.total_cases,
        "day",
        "entityName"
    )

    it("correctly builds a grapher variable", () => {
        expect(table.rows[3].totalCasesSmoothed).toEqual(14.5)
    })

    it("correctly builds a days since variable", () => {
        const newTable = table.withDaysSinceColumn(
            "daysSince",
            "totalCasesSmoothed",
            5,
            "Some title"
        )
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
        7,
        (row) => row.cases,
        "day",
        "entityName",
        7
    )

    it("correctly builds weekly average", () => {
        expect(table2.rows[3].weeklyCases).toEqual(70)
    })

    it("correctly builds weekly change", () => {
        table2 = table2.withRollingAverageColumn(
            { slug: "weeklyChange" },
            7,
            (row) => row.cases,
            "day",
            "entityName",
            7,
            7
        )

        expect(table2.rows[3].weeklyChange).toEqual(undefined)
        expect(table2.rows[8].weeklyChange).toEqual(0)
        expect(table2.rows[21].weeklyChange).toEqual(100)
    })
})

describe("builds aligned tests column", () => {
    let table = new CovidExplorerTable(covidSampleRows)

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

    const table3 = new CovidExplorerTable(covidSampleRows)
    it("rows are immutable", () => {
        expect(table3.columnSlugs.includes("tests-perThousand-daily")).toEqual(
            false
        )
    })
})

describe(getLeastUsedColor, () => {
    it("returns unused color", () => {
        expect(getLeastUsedColor(["red", "green"], ["red"])).toEqual("green")
    })

    it("returns least used color", () => {
        expect(
            getLeastUsedColor(["red", "green"], ["red", "green", "green"])
        ).toEqual("red")
    })
})

describe("do not include unselected groups in aligned charts", () => {
    it("can filter rows without continent", () => {
        let table = new CovidExplorerTable(covidSampleRows)
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

describe("column specs", () => {
    const table = new CovidExplorerTable([])
    it("computes unique slugs", () => {
        expect(
            uniq(
                [
                    "testsMetric=true&dailyFreq=true&smoothing=3&perCapita=true",
                    "casesMetric=true&dailyFreq=true&smoothing=3&perCapita=true",
                    "positiveTestRate=true&dailyFreq=true&smoothing=3&perCapita=true",
                    "casesMetric=true&dailyFreq=true&smoothing=3&perCapita=true",
                    "testsMetric=true&dailyFreq=true&smoothing=3&perCapita=false",
                    "testsMetric=true&dailyFreq=true&smoothing=0&perCapita=true",
                    "testsMetric=true&totalFreq=true&smoothing=3&perCapita=true",
                ].map(
                    (queryStr) =>
                        table.buildColumnSpec(new CovidQueryParams(queryStr))
                            .slug
                )
            ).length
        ).toEqual(6)
    })
})
