import * as React from "react"
import { CovidExplorer } from "explorer/covidExplorer/CovidExplorer"

export default {
    title: "CovidExplorer",
    component: CovidExplorer,
}

export const SingleExplorerWithKeyboardShortcuts = () => (
    <CovidExplorer enableKeyboardShortcuts={true} />
)

export const MultipleExplorers = () => (
    <div>
        <CovidExplorer />
        <CovidExplorer />
    </div>
)

export const MultiMetricExplorer = () => (
    <CovidExplorer queryStr="?tab=table&tableMetrics=cases~deaths~tests~tests_per_case~case_fatality_rate~positive_test_rate&time=2020-05-06" />
)
