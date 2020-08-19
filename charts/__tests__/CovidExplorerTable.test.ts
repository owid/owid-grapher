#! /usr/bin/env yarn jest

import {
    getLeastUsedColor,
    CovidExplorerTable
} from "../covidDataExplorer/CovidExplorerTable"
import { covidSampleRows } from "../../test/fixtures/CovidSampleRows"
import { OwidTable, BasicTable } from "charts/owidData/OwidTable"
import uniq from "lodash/uniq"
import { CovidQueryParams } from "charts/covidDataExplorer/CovidParams"
import { queryParamsToStr } from "utils/client/url"

describe("parse row", () => {
    it("correctly parses data from mega file", () => {
        expect(covidSampleRows[0].total_cases).toEqual(2)
    })
})

describe("makeCountryOptions", () => {
    it("correctly computes options", () => {
        const dataTable = new CovidExplorerTable(
            new OwidTable([]),
            covidSampleRows
        )
        expect(dataTable.table.availableEntities[2]).toEqual("World")
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
    const dataTable = new CovidExplorerTable(new OwidTable([]), covidSampleRows)
    dataTable.table.addRollingAverageColumn(
        { slug: "totalCasesSmoothed" },
        3,
        row => row.total_cases,
        "day",
        "entityName"
    )

    it("correctly builds a grapher variable", () => {
        expect(dataTable.table.rows[3].totalCasesSmoothed).toEqual(14.5)
    })

    it("correctly builds a days since variable", () => {
        const slug = dataTable.addDaysSinceColumn(
            "daysSince",
            "totalCasesSmoothed",
            123,
            5,
            "Some title"
        )
        expect(dataTable.table.rows[2][slug]).toEqual(0)
        expect(dataTable.table.rows[3][slug]).toEqual(1)
    })

    const rows = []
    for (let index = 0; index < 30; index++) {
        rows.push({
            entityName: "USA",
            cases: index < 15 ? 10 : 20,
            day: index
        })
    }
    const table = new BasicTable(rows)
    table.addRollingAverageColumn(
        { slug: "weeklyCases" },
        7,
        row => row.cases,
        "day",
        "entityName",
        7
    )

    it("correctly builds weekly average", () => {
        expect(table.rows[3].weeklyCases).toEqual(70)
    })

    table.addRollingAverageColumn(
        { slug: "weeklyChange" },
        7,
        row => row.cases,
        "day",
        "entityName",
        7,
        7
    )

    it("correctly builds weekly change", () => {
        expect(table.rows[3].weeklyChange).toEqual(undefined)
        expect(table.rows[8].weeklyChange).toEqual(0)
        expect(table.rows[21].weeklyChange).toEqual(100)
    })
})

describe("builds aligned tests column", () => {
    const dataTable = new CovidExplorerTable(new OwidTable([]), covidSampleRows)

    it("it has testing data", () => {
        expect(dataTable.table.columnSlugs.includes("tests-daily")).toEqual(
            false
        )

        const params = new CovidQueryParams("testsMetric=true&dailyFreq=true")
        dataTable.initTestingColumn(params.toConstrainedParams())

        expect(dataTable.table.columnSlugs.includes("tests-daily")).toEqual(
            true
        )

        const newParams = new CovidQueryParams(params.toString())
        newParams.perCapita = true
        dataTable.initTestingColumn(newParams.toConstrainedParams())

        expect(
            dataTable.table.columnSlugs.includes("tests-perThousand-daily")
        ).toEqual(true)

        const params3 = new CovidQueryParams(
            queryParamsToStr({
                aligned: "true",
                perCapita: "true",
                testsMetric: "true",
                totalFreq: "true"
            })
        )

        dataTable.initRequestedColumns(params3.toConstrainedParams())

        expect(
            dataTable.table.columnSlugs.includes("deaths-perMil-total")
        ).toEqual(true)
    })

    const dataTable2 = new CovidExplorerTable(
        new OwidTable([]),
        covidSampleRows
    )
    it("rows are immutable", () => {
        expect(
            dataTable2.table.columnSlugs.includes("tests-perThousand-daily")
        ).toEqual(false)
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
    const dataTable = new CovidExplorerTable(new OwidTable([]), covidSampleRows)
    it("can filter rows without continent", () => {
        expect(dataTable.table.unfilteredEntities.has("World")).toBeTruthy()
        dataTable.addGroupFilterColumn()
        expect(dataTable.table.unfilteredEntities.has("World")).toBeFalsy()
        dataTable.table.selectEntity("World")
        expect(dataTable.table.unfilteredEntities.has("World")).toBeTruthy()
        dataTable.table.deselectEntity("World")
        expect(dataTable.table.unfilteredEntities.has("World")).toBeFalsy()
        dataTable.table.setSelectedEntities(["World"])
        expect(dataTable.table.unfilteredEntities.has("World")).toBeTruthy()
    })
})

describe("column specs", () => {
    const dataTable = new CovidExplorerTable(new OwidTable([]), [])
    it("computes unique variable ids", () => {
        expect(
            uniq(
                [
                    "testsMetric=true&dailyFreq=true&smoothing=3&perCapita=true",
                    "casesMetric=true&dailyFreq=true&smoothing=3&perCapita=true",
                    "positiveTestRate=true&dailyFreq=true&smoothing=3&perCapita=true",
                    "casesMetric=true&dailyFreq=true&smoothing=3&perCapita=true",
                    "testsMetric=true&dailyFreq=true&smoothing=3&perCapita=false",
                    "testsMetric=true&dailyFreq=true&smoothing=0&perCapita=true",
                    "testsMetric=true&totalFreq=true&smoothing=3&perCapita=true"
                ].map(
                    queryStr =>
                        dataTable.buildColumnSpec(
                            new CovidQueryParams(queryStr)
                        ).owidVariableId
                )
            ).length
        ).toEqual(6)
    })
})
