#! /usr/bin/env yarn jest

import { CovidDataExplorer } from "../covidDataExplorer/CovidDataExplorer"
import { CovidQueryParams } from "charts/covidDataExplorer/CovidChartUrl"
import { covidSampleRows } from "../../test/fixtures/CovidSampleRows"
import React from "react"
import { shallow, mount, ReactWrapper } from "enzyme"
import { MetricOptions } from "charts/covidDataExplorer/CovidTypes"

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

class ExplorerDataTableTest {
    view: ReactWrapper
    params: CovidQueryParams

    constructor(view: ReactWrapper, params: CovidQueryParams) {
        this.view = view
        this.params = params
    }

    // untested with subheaders
    get headers() {
        return this.view
            .find("thead tr")
            .first()
            .find("th span.name")
            .map(tableHeader => tableHeader.text())
    }

    bodyRow(index: number) {
        return this.view
            .find("tbody tr")
            .at(index)
            .find("td")
            .map(td => td.text())
    }
}

describe("When you try to create a multimetric Data Explorer", () => {
    let dataTableTester: ExplorerDataTableTest
    beforeAll(() => {
        const explorerParams = new CovidQueryParams(
            "?tab=table&tableMetrics=cases~deaths~tests~tests_per_case~case_fatality_rate~positive_test_rate"
        )
        const explorerView = mount(
            <CovidDataExplorer
                data={covidSampleRows}
                params={explorerParams}
                queryStr="?tab=table&time=2020-05-06"
                covidChartAndVariableMeta={dummyMeta}
                updated="2020-05-09T18:59:31"
            />
        )

        dataTableTester = new ExplorerDataTableTest(
            explorerView,
            explorerParams
        )
    })

    it("renders a table", () => {
        expect(dataTableTester.view.find("table")).toHaveLength(1)
    })

    it("renders correct table headers", () => {
        expect(dataTableTester.headers).toEqual([
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

    describe("when you fewer metrics", () => {
        const explorerParams = new CovidQueryParams(
            "?tab=table&tableMetrics=cases~deaths~tests_per_case"
        )
        const explorerView = mount(
            <CovidDataExplorer
                data={covidSampleRows}
                params={explorerParams}
                queryStr="?tab=table&time=2020-05-06"
                covidChartAndVariableMeta={dummyMeta}
                updated="2020-05-09T18:59:31"
            />
        )

        const dataTableTester = new ExplorerDataTableTest(
            explorerView,
            explorerParams
        )

        test("table headers show only the metrics you select", () => {
            expect(dataTableTester.headers).toEqual([
                "Confirmed cases",
                "Confirmed cases",
                "Confirmed deaths",
                "Confirmed deaths",
                "Tests per confirmed case"
            ])
        })
    })

    const SECOND_ROW = [
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
    ]

    it("renders correct table rows", () => {
        expect(dataTableTester.bodyRow(1)).toEqual(SECOND_ROW)
    })

    describe("It doesn't change on the following options", () => {
        it("does not change if explorer metrics change", () => {
            MetricOptions.forEach(metric => {
                dataTableTester.params.setMetric(metric)
                expect(dataTableTester.bodyRow(1)).toEqual(SECOND_ROW)
            })
        })

        it("does not change if 'align outbreaks' is changed", () => {
            dataTableTester.params.aligned = false
            expect(dataTableTester.bodyRow(1)).toEqual(SECOND_ROW)

            dataTableTester.params.aligned = true
            expect(dataTableTester.bodyRow(1)).toEqual(SECOND_ROW)
        })
    })
})
