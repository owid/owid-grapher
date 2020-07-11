#! /usr/bin/env yarn jest

import {
    getLeastUsedColor,
    CovidExplorerTable
} from "../covidDataExplorer/CovidExplorerTable"
import { csvParse } from "d3-dsv"
import { testData } from "../../test/fixtures/CovidTestData"
import { ParsedCovidCsvRow } from "charts/covidDataExplorer/CovidTypes"
import { OwidTable } from "charts/owidData/OwidTable"
import uniq from "lodash/uniq"
import { CovidConstrainedQueryParams } from "charts/covidDataExplorer/CovidChartUrl"

const getRows = () => {
    const testRows: ParsedCovidCsvRow[] = csvParse(testData) as any
    return testRows.map(CovidExplorerTable.parseCovidRow)
}

describe("parse row", () => {
    const parsedRows = getRows()
    it("correctly parses data from mega file", () => {
        expect(parsedRows[0].total_cases).toEqual(2)
    })
})

describe("makeCountryOptions", () => {
    const parsedRows = getRows()
    it("correctly computes options", () => {
        const options = CovidExplorerTable.makeCountryOptions(parsedRows)
        const world = options[2]
        expect(world.name).toEqual("World")
    })
})

describe("generateContinentRows", () => {
    const parsedRows = getRows()
    it("correctly groups continents and adds rows for each", () => {
        const regionRows = CovidExplorerTable.generateContinentRows(parsedRows)
        expect(regionRows.length).toEqual(6)
        expect(regionRows[regionRows.length - 1].total_cases).toEqual(46451)
    })
})

describe("build covid column", () => {
    const dataTable = new CovidExplorerTable(new OwidTable([]), getRows())
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
    const dataTable = new CovidExplorerTable(new OwidTable([]), getRows())

    it("it has testing data", () => {
        expect(dataTable.table.columnSlugs.includes("tests-daily")).toEqual(
            false
        )

        const params: Partial<CovidConstrainedQueryParams> = {
            testsMetric: true,
            dailyFreq: true
        }
        dataTable.initTestingColumn(params as CovidConstrainedQueryParams)

        expect(dataTable.table.columnSlugs.includes("tests-daily")).toEqual(
            true
        )

        const newParams = { ...params, perCapita: true }
        dataTable.initTestingColumn(newParams as CovidConstrainedQueryParams)

        expect(
            dataTable.table.columnSlugs.includes("tests-perThousand-daily")
        ).toEqual(true)

        const params3: Partial<CovidConstrainedQueryParams> = {
            aligned: true,
            perCapita: true,
            testsMetric: true,
            totalFreq: true
        }

        dataTable.initRequestedColumns(params3 as CovidConstrainedQueryParams)

        expect(
            dataTable.table.columnSlugs.includes("deaths-perMil-cumulative")
        ).toEqual(true)
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
    const dataTable = new CovidExplorerTable(new OwidTable([]), getRows())
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
