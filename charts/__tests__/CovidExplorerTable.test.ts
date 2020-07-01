#! /usr/bin/env yarn jest

import {
    parseCovidRow,
    makeCountryOptions,
    getLeastUsedColor,
    generateContinentRows,
    CovidExplorerTable
} from "../covidDataExplorer/CovidExplorerTable"
import { csvParse } from "d3-dsv"
import { testData } from "../../test/fixtures/CovidTestData"
import { ParsedCovidCsvRow } from "charts/covidDataExplorer/CovidTypes"
import { OwidTable } from "charts/owidData/OwidTable"
import uniq from "lodash/uniq"

const getRows = () => {
    const testRows: ParsedCovidCsvRow[] = csvParse(testData) as any
    return testRows.map(parseCovidRow)
}

describe(parseCovidRow, () => {
    const parsedRows = getRows()
    it("correctly parses data from mega file", () => {
        expect(parsedRows[0].total_cases).toEqual(2)
    })
})

describe(makeCountryOptions, () => {
    const parsedRows = getRows()
    it("correctly computes options", () => {
        const options = makeCountryOptions(parsedRows)
        const world = options[2]
        expect(world.code).toEqual("OWID_WRL")
    })
})

describe(generateContinentRows, () => {
    const parsedRows = getRows()
    it("correctly groups continents and adds rows for each", () => {
        const regionRows = generateContinentRows(parsedRows)
        expect(regionRows.length).toEqual(6)
        expect(regionRows[regionRows.length - 1].total_cases).toEqual(46451)
    })
})

describe("build covid column", () => {
    const parsedRows = getRows()
    const dataTable = new CovidExplorerTable(new OwidTable([]), parsedRows)
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
