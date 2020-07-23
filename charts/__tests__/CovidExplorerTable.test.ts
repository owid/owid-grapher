#! /usr/bin/env yarn jest

import {
    getLeastUsedColor,
    CovidExplorerTable
} from "../covidDataExplorer/CovidExplorerTable"
import { covidSampleRows } from "../../test/fixtures/CovidSampleRows"
import { OwidTable } from "charts/owidData/OwidTable"
import uniq from "lodash/uniq"
import { CovidQueryParams } from "charts/covidDataExplorer/CovidChartUrl"
import { queryParamsToStr } from "utils/client/url"

describe("parse row", () => {
    it("correctly parses data from mega file", () => {
        expect(covidSampleRows[0].total_cases).toEqual(2)
    })
})

describe("makeCountryOptions", () => {
    it("correctly computes options", () => {
        const options = CovidExplorerTable.makeCountryOptions(covidSampleRows)
        const world = options[2]
        expect(world.name).toEqual("World")
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
})

describe("builds aligned tests column", () => {
    const dataTable = new CovidExplorerTable(new OwidTable([]), covidSampleRows)

    it("it has testing data", () => {
        expect(dataTable.table.columnSlugs.includes("tests-daily")).toEqual(
            false
        )

        const params = new CovidQueryParams("testsMetric=true&dailyFreq=true")
        dataTable.initTestingColumn(params.constrainedParams)

        expect(dataTable.table.columnSlugs.includes("tests-daily")).toEqual(
            true
        )

        const newParams = new CovidQueryParams(params.toString())
        newParams.perCapita = true
        dataTable.initTestingColumn(newParams.constrainedParams)

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

        dataTable.initRequestedColumns(params3.constrainedParams)

        expect(
            dataTable.table.columnSlugs.includes("deaths-perMil-cumulative")
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
                    dataTable.buildColumnSpec("tests", 1000, true, 3),
                    dataTable.buildColumnSpec("cases", 1000, true, 3),
                    dataTable.buildColumnSpec("tests", 100, true, 3),
                    dataTable.buildColumnSpec("tests", 1000, true, 0),
                    dataTable.buildColumnSpec("tests", 1000, false, 3)
                ].map(spec => spec.owidVariableId)
            ).length
        ).toEqual(5)
    })
})
