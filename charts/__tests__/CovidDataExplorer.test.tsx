#! /usr/bin/env yarn jest

import { CovidDataExplorer } from "../covidDataExplorer/CovidDataExplorer"
import { CovidQueryParams } from "charts/covidDataExplorer/CovidChartUrl"
import { covidSampleRows } from "../../test/fixtures/CovidSampleRows"
import React from "react"
import { shallow, mount, ReactWrapper } from "enzyme"
import { MultiMetricExplorer } from "../../stories/covidDataExplorer.stories"

const dummyMeta = {
    charts: {},
    variables: {}
}

describe(CovidDataExplorer, () => {
    it("renders the Covid Data Explorer", () => {
        const startingParams = new CovidQueryParams("")
        const element = shallow(
            <CovidDataExplorer
                data={covidSampleRows}
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

describe.only("When you try to create a multimetric Data Explorer", () => {
    let explorerView: ReactWrapper
    beforeAll(() => {
        explorerView = mount(<MultiMetricExplorer />)
    })

    it("renders a table", () => {
        expect(explorerView.find("table")).toHaveLength(1)
    })

    it("renders correct table headers", () => {
        const tableHeader = explorerView
            .find("thead tr")
            .first()
            .find("th span.name")
            .map(tableHeader => tableHeader.text())

        expect(tableHeader).toEqual([
            "Confirmed cases",
            "Confirmed cases",
            "Confirmed deaths",
            "Confirmed deaths",
            "Tests",
            "Tests",
            "Tests per confirmed case",
            "Case fatality rate",
            "Share of positive tests"
        ])
    })

    it("renders correct table rows", () => {
        const tableRows = explorerView.find("tbody tr")
        const secondRow = tableRows
            .at(1)
            .find("td")
            .map(td => td.text())

        expect(secondRow).toEqual([
            "United States",
            "1.20 million",
            "23,841",
            "71,078",
            "2,144",
            "May 5 7.54 million",
            "May 5 258,954",
            "May 5 6",
            "5.9",
            "May 5 0.2"
        ])
    })
})
