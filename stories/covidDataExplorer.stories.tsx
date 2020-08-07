import * as React from "react"
import { CovidDataExplorer } from "charts/covidDataExplorer/CovidDataExplorer"
import { covidSampleRows } from "test/fixtures/CovidSampleRows"
import { CovidQueryParams } from "charts/covidDataExplorer/CovidChartUrl"

export default {
    title: "CovidDataExplorer"
}

const EMPTY_DUMMY_META = {
    charts: {},
    variables: {}
}

export const SingleExplorerWithKeyboardShortcuts = () => {
    return (
        <CovidDataExplorer
            data={covidSampleRows}
            params={new CovidQueryParams("")}
            covidChartAndVariableMeta={EMPTY_DUMMY_META}
            updated="2020-05-09T18:59:31"
            enableKeyboardShortcuts={true}
        />
    )
}

export const MultipleExplorers = () => {
    return (
        <>
            <CovidDataExplorer
                data={covidSampleRows}
                params={new CovidQueryParams("")}
                covidChartAndVariableMeta={EMPTY_DUMMY_META}
                updated="2020-05-09T18:59:31"
            />
            <CovidDataExplorer
                data={covidSampleRows}
                params={new CovidQueryParams("")}
                covidChartAndVariableMeta={EMPTY_DUMMY_META}
                updated="2020-05-09T18:59:31"
            />
        </>
    )
}

export const MultiMetricExplorer = () => {
    const startingParams = new CovidQueryParams(
        "?tab=table&tableMetrics=cases~deaths~tests~tests_per_case~case_fatality_rate~positive_test_rate"
    )
    return (
        <CovidDataExplorer
            data={covidSampleRows}
            params={startingParams}
            queryStr="?tab=table&time=2020-05-06"
            covidChartAndVariableMeta={EMPTY_DUMMY_META}
            updated="2020-05-09T18:59:31"
        />
    )
}

export const MultiMetricExplorerPerCapita = () => {
    const startingParams = new CovidQueryParams(
        "?tab=table&tableMetrics=cases~deaths~tests~tests_per_case~case_fatality_rate~positive_test_rate"
    )
    return (
        <CovidDataExplorer
            data={covidSampleRows}
            params={startingParams}
            queryStr="?tab=table&time=2020-05-06"
            covidChartAndVariableMeta={EMPTY_DUMMY_META}
            updated="2020-05-09T18:59:31"
        />
    )
}
