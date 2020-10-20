#! /usr/bin/env yarn jest

import { CovidExplorer } from "./CovidExplorer"
import { CovidQueryParams } from "explorer/covidExplorer/CovidParams"
import React from "react"
import { mount, ReactWrapper } from "enzyme"
import { IntervalOptions, metricLabels, MetricOptions } from "./CovidConstants"
import { sampleMegaCsv } from "./CovidExplorerUtils"
import { ThereWasAProblemLoadingThisChart } from "grapher/core/GrapherConstants"

const dummyMeta = {
    charts: {},
    variables: {},
}

const makeMountedExplorer = (params: string) =>
    mount(
        <CovidExplorer
            megaCsv={sampleMegaCsv}
            params={new CovidQueryParams(params)}
            covidChartAndVariableMeta={dummyMeta}
            updated="2020-05-09T18:59:31"
        />
    )

describe(CovidExplorer, () => {
    it("renders the Covid Data Explorer", () => {
        const element = makeMountedExplorer("")
        const headerText = element.find(".ExplorerHeaderBox").text()
        // Need to split it off because the lines are in separate elements
        expect(headerText).toContain("Coronavirus Pandemic")
        expect(headerText).toContain("Data Explorer")
    })

    it("cfr works", () => {
        const text = makeMountedExplorer(
            "?cfrMetric=true&country=North%20America"
        ).text()
        expect(text).not.toContain(ThereWasAProblemLoadingThisChart)
        expect(text).toContain(`ratio`)
    })
})

const defaultParams = () =>
    new CovidQueryParams(
        "?tab=table&tableMetrics=cases~deaths~tests~tests_per_case~case_fatality_rate~positive_test_rate"
    )

class ExplorerDataTableTest {
    private params: CovidQueryParams
    view: ReactWrapper

    constructor(params = defaultParams()) {
        this.params = params
        this.view = mount(
            <CovidExplorer
                megaCsv={sampleMegaCsv}
                params={this.params}
                queryStr="?tab=table&time=2020-05-06"
                covidChartAndVariableMeta={dummyMeta}
                updated="2020-05-09T18:59:31"
            />
        )
    }

    // untested with subheaders
    get headers() {
        return this.view
            .find("thead tr")
            .first()
            .find("th span.name")
            .map((tableHeader) => tableHeader.text())
    }

    bodyRow(index: number) {
        return this.view
            .find("tbody tr")
            .at(index)
            .find("td")
            .map((td) => td.text())
    }
}

// Todo: add these back but via Column Specs, not dimension specs.
describe.skip("When you try to create a multimetric Data Explorer", () => {
    let dataTableTester: ExplorerDataTableTest
    beforeAll(() => {
        dataTableTester = new ExplorerDataTableTest()
    })

    it("renders a table", () => {
        expect(dataTableTester.view.find("table")).toHaveLength(1)
    })

    it("renders correct table headers", () => {
        expect(dataTableTester.headers.sort()).toEqual(
            Object.values(metricLabels).sort()
        )
    })

    const SECOND_ROW = [
        "United States",
        "1.20 million",
        "71,078",
        "May 5 7.54 million",
        "May 5 6",
        "5.9",
        "May 5 0.2",
    ]

    it("renders correct table rows", () => {
        expect(dataTableTester.bodyRow(1)).toEqual(SECOND_ROW)
    })

    describe("when you have fewer metrics", () => {
        let dataTableTester: ExplorerDataTableTest
        beforeAll(() => {
            const explorerParams = new CovidQueryParams(
                "?tab=table&tableMetrics=cases~deaths~tests_per_case"
            )
            dataTableTester = new ExplorerDataTableTest(explorerParams)
        })

        test("table headers show only the metrics you select", () => {
            expect(dataTableTester.headers).toEqual([
                "Confirmed cases",
                "Confirmed deaths",
                "Tests per confirmed case",
            ])
        })
    })

    describe("It doesn't change when", () => {
        it("explorer metrics change", () => {
            Object.values(MetricOptions).forEach((metric) => {
                const params = defaultParams()
                params.setMetric(metric)
                const dataTableTester = new ExplorerDataTableTest(params)
                expect(dataTableTester.bodyRow(1)).toEqual(SECOND_ROW)
            })
        })

        it("'align outbreaks' is enabled", () => {
            const params = defaultParams()
            params.aligned = true
            const dataTableTester = new ExplorerDataTableTest(params)
            expect(dataTableTester.bodyRow(1)).toEqual(SECOND_ROW)
        })
    })

    describe("It changes when", () => {
        test("'per capita' is enabled", () => {
            const params = defaultParams()
            params.perCapita = true
            const dataTableTester = new ExplorerDataTableTest(params)

            expect(dataTableTester.bodyRow(1)).toEqual([
                "United States",
                "602.24 million",
                "35.54 million",
                "May 5 3.77 million",
                "May 5 6",
                "5.9",
                "May 5 0.2",
            ])
        })

        describe("interval is changed", () => {
            test("interval is set to daily", () => {
                const params = defaultParams()
                params.interval = IntervalOptions.daily
                const dataTableTester = new ExplorerDataTableTest(params)

                expect(dataTableTester.bodyRow(1)).toEqual([
                    "United States",
                    "1.20 million",
                    "23,841",
                    "71,078",
                    "2,144",
                    "May 5 7.54 million",
                    "May 5 258,954",
                    "May 5 6",
                    "5.9",
                    "May 5 0.2",
                ])
            })

            test("interval is set to weekly change", () => {
                const params = defaultParams()
                params.interval = IntervalOptions.weekly
                const dataTableTester = new ExplorerDataTableTest(params)

                expect(dataTableTester.bodyRow(1)).toEqual([
                    "United States",
                    "1.20 million",
                    "162,519.0",
                    "71,078",
                    "11,886.0",
                    "May 5 7.54 million",
                    "May 5 6",
                    "5.9",
                    "May 5 0.2",
                ])
            })
        })
    })
})
