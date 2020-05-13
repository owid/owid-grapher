#! /usr/bin/env yarn jest

import {
    buildCovidVariableId,
    daysSinceVariable,
    parseCovidRow,
    makeCountryOptions,
    getLeastUsedColor,
    buildCovidVariable
} from "../covidDataExplorer/CovidDataUtils"
import uniq from "lodash/uniq"
import { csvParse } from "d3-dsv"
import { testData } from "../../test/fixtures/CovidTestData"

describe(buildCovidVariableId, () => {
    it("computes unique variable ids", () => {
        expect(
            uniq([
                buildCovidVariableId("tests", 1000, 3, true),
                buildCovidVariableId("cases", 1000, 3, true),
                buildCovidVariableId("tests", 100, 3, true),
                buildCovidVariableId("tests", 1000, 0, true),
                buildCovidVariableId("tests", 1000, 3, false)
            ]).length
        ).toEqual(5)
    })
})

describe(parseCovidRow, () => {
    it("correctly parses data from mega file", () => {
        const testRows = csvParse(testData)
        const parsedRows = testRows.map(parseCovidRow)
        expect(parsedRows[0].total_cases).toEqual(2)
    })
})

describe(makeCountryOptions, () => {
    it("correctly computes options", () => {
        const testRows = csvParse(testData)
        const parsedRows = testRows.map(parseCovidRow)
        const options = makeCountryOptions(parsedRows)
        const world = options[2]
        expect(world.code).toEqual("OWID_WRL")
        const usa = options[1]
        expect(usa.latestTotalTestsPerCase).toEqual(7544328.0 / 1180634)
    })
})

describe(buildCovidVariable, () => {
    const testRows = csvParse(testData)
    const parsedRows = testRows.map(parseCovidRow)
    const options = makeCountryOptions(parsedRows)
    const map = new Map()
    options.forEach((country, index) => {
        map.set(country.name, index)
    })
    const totalCases3DaySmoothing = buildCovidVariable(
        123,
        "cases",
        map,
        parsedRows,
        row => row.total_cases,
        1,
        3,
        true,
        " Updated 2/2/2020"
    )
    it("correctly builds a grapher variable", () => {
        expect(totalCases3DaySmoothing.values[3]).toEqual(14.5)
    })
    it("correctly builds a days since variable", () => {
        const variable = daysSinceVariable(totalCases3DaySmoothing, 1)
        expect(variable.values[3]).toEqual(12)
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
