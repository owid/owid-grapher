#! /usr/bin/env yarn jest

import { CovidDataExplorer } from "../covidDataExplorer/CovidDataExplorer"
import { CovidQueryParams } from "charts/covidDataExplorer/CovidChartUrl"
import { covidSampleRows } from "../../test/fixtures/CovidSampleRows"
import React from "react"
import { shallow } from "enzyme"

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
