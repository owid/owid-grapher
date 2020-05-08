#! /usr/bin/env yarn jest

import { CovidDataExplorer } from "../covidDataExplorer/CovidDataExplorer"
import { CovidQueryParams } from "charts/covidDataExplorer/CovidChartUrl"
import { testData } from "../../test/fixtures/CovidTestData"
import { csvParse } from "d3"
import { parseCovidRow } from "charts/covidDataExplorer/CovidDataUtils"
import React from "react"
import { shallow } from "enzyme"
import { Bounds } from "charts/Bounds"

describe(CovidDataExplorer, () => {
    it("renders the Covid Data Explorer", () => {
        const testRows = csvParse(testData)
        const parsedRows = testRows.map(parseCovidRow)
        const startingParams = new CovidQueryParams("")
        const bounds = new Bounds(0, 0, 800, 600)
        const element = shallow(
            <CovidDataExplorer
                data={parsedRows}
                params={startingParams}
                bounds={bounds}
            />
        )

        expect(element.html()).toContain("Covid-19 Data Explorer")
    })
})
