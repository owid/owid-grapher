#! /usr/bin/env yarn jest

import {
    parseCovidRow,
    makeCountryOptions,
    getLeastUsedColor,
    generateContinentRows,
    addDaysSinceColumn
} from "../covidDataExplorer/CovidDataUtils"
import { csvParse } from "d3-dsv"
import { testData } from "../../test/fixtures/CovidTestData"
import { ParsedCovidCsvRow } from "charts/covidDataExplorer/CovidTypes"
import { OwidTable } from "charts/owidData/OwidTable"

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
    const table = new OwidTable(parsedRows)
    table.addRollingAverageColumn(
        { slug: "totalCasesSmoothed" },
        3,
        row => row.total_cases,
        "day",
        "entityName"
    )

    it("correctly builds a grapher variable", () => {
        expect(table.rows[3].totalCasesSmoothed).toEqual(14.5)
    })

    it("correctly builds a days since variable", () => {
        const slug = addDaysSinceColumn(
            table,
            "totalCasesSmoothed",
            123,
            5,
            "Some title"
        )
        expect(table.rows[2][slug]).toEqual(0)
        expect(table.rows[3][slug]).toEqual(1)
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
