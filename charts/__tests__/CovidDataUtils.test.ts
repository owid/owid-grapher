#! /usr/bin/env yarn jest

import {
    buildCovidVariableId,
    daysSinceVariable,
    parseCovidRow,
    makeCountryOptions
} from "../covidDataExplorer/CovidDataUtils"
import uniq from "lodash/uniq"
import { csvParse } from "d3"

const testData = `iso_code,location,date,total_cases,new_cases,total_deaths,new_deaths,total_cases_per_million,new_cases_per_million,total_deaths_per_million,new_deaths_per_million,total_tests,new_tests,total_tests_per_thousand,new_tests_per_thousand,tests_units
ABW,Aruba,2020-03-13,2,2,0,0,18.733,18.733,0.0,0.0,,,,,
ABW,Aruba,2020-03-20,4,2,0,0,37.465,18.733,0.0,0.0,,,,,
ABW,Aruba,2020-03-24,12,8,0,0,112.395,74.93,0.0,0.0,,,,,
ABW,Aruba,2020-03-25,17,5,0,0,159.227,46.831,0.0,0.0,,,,,
USA,United States,2020-05-05,1180634,22593,68934,1252,3566.842,68.256,208.258,3.782,7544328.0,258954.0,22.792,0.782,inconsistent units (COVID Tracking Project)
USA,United States,2020-05-06,1204475,23841,71078,2144,3638.868,72.027,214.735,6.477,,,,,
,World,2020-05-01,3215927,84440,232869,5534,412.573,10.833,29.875,0.71,,,,,
,World,2020-05-02,3308891,92964,238707,5838,424.5,11.926,30.624,0.749,,,,,
,World,2020-05-03,3389459,80568,243476,4769,434.836,10.336,31.236,0.612,,,,,
,World,2020-05-04,3467502,78043,246999,3523,444.848,10.012,31.688,0.452,,,,,
,World,2020-05-05,3544168,76666,250977,3978,454.684,9.836,32.198,0.51,,,,,
,World,2020-05-06,3623803,79635,256880,5903,464.9,10.216,32.955,0.757,,,,,`

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
