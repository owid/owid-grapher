import * as React from "react"
import "site/client/owid.scss"
import "charts/client/chart.scss"
import { CovidDataExplorer } from "charts/covidDataExplorer/CovidDataExplorer"
import { covidSampleRows } from "test/fixtures/CovidSampleRows"
import { CovidQueryParams } from "charts/covidDataExplorer/CovidChartUrl"

export default {
    title: "CovidDataExplorer"
}

export const SingleExplorerWithKeyboardShortcuts = () => {
    const dummyMeta = {
        charts: {},
        variables: {}
    }
    return (
        <CovidDataExplorer
            data={covidSampleRows}
            params={new CovidQueryParams("")}
            covidChartAndVariableMeta={dummyMeta}
            updated="2020-05-09T18:59:31"
            enableKeyboardShortcuts={true}
        />
    )
}

export const MultipleExplorers = () => {
    const dummyMeta = {
        charts: {},
        variables: {}
    }
    return (
        <>
            <CovidDataExplorer
                data={covidSampleRows}
                params={new CovidQueryParams("")}
                covidChartAndVariableMeta={dummyMeta}
                updated="2020-05-09T18:59:31"
            />
            <CovidDataExplorer
                data={covidSampleRows}
                params={new CovidQueryParams("")}
                covidChartAndVariableMeta={dummyMeta}
                updated="2020-05-09T18:59:31"
            />
        </>
    )
}
