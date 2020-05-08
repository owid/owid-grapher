#! /usr/bin/env yarn jest

import {
    buildCovidVariableId,
    daysSinceVariable,
    parseCovidRow,
    makeCountryOptions
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

describe(daysSinceVariable, () => {
    it("correctly computes days since variable", () => {
        const testRows = csvParse(testData)
        const parsedRows = testRows.map(parseCovidRow)
        const options = makeCountryOptions(parsedRows)
        const map = new Map()
        options.forEach((country, index) => {
            map.set(country.name, index)
        })
        const variable = daysSinceVariable(
            parsedRows,
            map,
            row => row.total_cases > 350000
        )
        expect(variable.values.length).toEqual(8)
    })
})
