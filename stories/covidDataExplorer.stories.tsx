import * as React from "react"

import { storiesOf } from "@storybook/react"

import "site/client/owid.scss"
import "charts/client/chart.scss"
import { CovidDataExplorer } from "charts/covidDataExplorer/CovidDataExplorer"
import { covidSampleRows } from "test/fixtures/CovidSampleRows"
import { CovidQueryParams } from "charts/covidDataExplorer/CovidChartUrl"

storiesOf("CovidDataExplorer", module)
    .add("single with keyboard shortcuts", () => {
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
    })
    .add("multiple", () => {
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
    })
