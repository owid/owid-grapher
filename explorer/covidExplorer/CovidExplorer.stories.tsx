import * as React from "react"
import { CovidExplorer, PerfTest } from "explorer/covidExplorer/CovidExplorer"

export default {
    title: "CovidExplorer",
    component: CovidExplorer,
}

export const SingleExplorerWithKeyboardShortcuts = () => (
    <CovidExplorer enableKeyboardShortcuts={true} />
)

export const Perf = () => (
    <div>
        <button onClick={PerfTest}>Perf</button>
    </div>
)

export const MultipleExplorersOnOnePage = () => (
    <div>
        <div style={{ height: "800px" }}>
            <CovidExplorer />
        </div>
        <div>
            <CovidExplorer />
        </div>
    </div>
)

export const MultiMetricExplorer = () => (
    <CovidExplorer queryStr="?tab=table&tableMetrics=cases~deaths~tests~tests_per_case~case_fatality_rate~positive_test_rate&time=2020-05-06" />
)
