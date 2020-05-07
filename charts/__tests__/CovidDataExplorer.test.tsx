#! /usr/bin/env yarn jest

import { CovidDataExplorer } from "../covidDataExplorer/CovidDataExplorer"
import { CovidQueryParams } from "charts/covidDataExplorer/CovidChartUrl"
import { testData } from "../../test/fixtures/CovidTestData"
import { csvParse } from "d3"
import { parseCovidRow } from "charts/covidDataExplorer/CovidDataUtils"
import React from "react"
import { shallow } from "enzyme"

describe(CovidDataExplorer, () => {
    it("renders the Covid Data Explorer", () => {
        const testRows = csvParse(testData)
        const parsedRows = testRows.map(parseCovidRow)
        const startingParams = new CovidQueryParams("")
        const element = shallow(
            <CovidDataExplorer data={parsedRows} params={startingParams} />
        )

        expect(element.html()).toContain("Covid-19 Data Explorer")
    })
})
