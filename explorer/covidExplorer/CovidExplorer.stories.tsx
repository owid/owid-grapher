import * as React from "react"
import { CovidExplorer } from "explorer/covidExplorer/CovidExplorer"
import { CovidQueryParams } from "explorer/covidExplorer/CovidParams"
import { sampleMegaRows } from "./CovidExplorerUtils"

export default {
    title: "CovidExplorer",
    component: CovidExplorer,
}

const EMPTY_DUMMY_META = {
    charts: {},
    variables: {},
}

export const SingleExplorerWithKeyboardShortcuts = () => {
    return (
        <CovidExplorer
            megaRows={sampleMegaRows}
            params={new CovidQueryParams("")}
            covidChartAndVariableMeta={EMPTY_DUMMY_META}
            updated="2020-05-09T18:59:31"
            enableKeyboardShortcuts={true}
        />
    )
}

export const MultipleExplorers = () => {
    return (
        <div>
            <CovidExplorer
                megaRows={sampleMegaRows}
                params={new CovidQueryParams("")}
                covidChartAndVariableMeta={EMPTY_DUMMY_META}
                updated="2020-05-09T18:59:31"
            />
            <CovidExplorer
                megaRows={sampleMegaRows}
                params={new CovidQueryParams("")}
                covidChartAndVariableMeta={EMPTY_DUMMY_META}
                updated="2020-05-09T18:59:31"
            />
        </div>
    )
}

export const MultiMetricExplorer = () => {
    const startingParams = new CovidQueryParams(
        "?tab=table&tableMetrics=cases~deaths~tests~tests_per_case~case_fatality_rate~positive_test_rate"
    )
    return (
        <CovidExplorer
            megaRows={sampleMegaRows}
            params={startingParams}
            queryStr="?tab=table&time=2020-05-06"
            covidChartAndVariableMeta={EMPTY_DUMMY_META}
            updated="2020-05-09T18:59:31"
        />
    )
}
