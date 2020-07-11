#! /usr/bin/env yarn jest

import { CovidDataExplorer } from "../covidDataExplorer/CovidDataExplorer"
import { CovidQueryParams } from "charts/covidDataExplorer/CovidChartUrl"
import { testData } from "../../test/fixtures/CovidTestData"
import { csvParse } from "d3-dsv"
import { CovidExplorerTable } from "charts/covidDataExplorer/CovidExplorerTable"
import React from "react"
import { shallow } from "enzyme"
import { ParsedCovidCsvRow } from "charts/covidDataExplorer/CovidTypes"

const getRows = () => {
    const testRows: ParsedCovidCsvRow[] = csvParse(testData) as any
    return testRows.map(CovidExplorerTable.parseCovidRow)
}

const dummyMeta = {
    charts: {},
    variables: {}
}

describe(CovidDataExplorer, () => {
    it("renders the Covid Data Explorer", () => {
        const parsedRows = getRows()
        const startingParams = new CovidQueryParams("")
        const element = shallow(
            <CovidDataExplorer
                data={parsedRows}
                params={startingParams}
                covidChartAndVariableMeta={dummyMeta}
                updated="2020-05-09T18:59:31"
            />
        )

        const headerText = element.find(".CovidHeaderBox").text()

        // Need to split it off because the lines are in separate elements
        expect(headerText).toContain("Coronavirus Pandemic")
        expect(headerText).toContain("Data Explorer")
    })
})
