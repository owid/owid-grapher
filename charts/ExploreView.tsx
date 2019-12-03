import * as React from "react"
import * as ReactDOM from "react-dom"

import { Bounds } from "./Bounds"
import { ChartView } from "./ChartView"
import { ChartConfig } from "./ChartConfig"

// Hardcoding some dummy config for now so we can display a chart.
// There will eventually be a list of these, downloaded from a static JSON file.
// -@jasoncrawford 2 Dec 2019
const DUMMY_JSON_CONFIG = {
    id: 677,
    title: "Child mortality rate",
    subtitle: "Share of newborns who die before reaching the age of five.",
    sourceDesc: "IHME, Global Burden of Disease",
    note: "",
    dimensions: [{ display: {}, property: "y", variableId: 104402 }],
    selectedData: [{ index: 0, entityId: 355 }]
}

// This component was modeled after ChartView.
//
// TODO that ChartView handles but this doesn't:
// * re-render on window resize event (throttled)
// * FullStory event logging on bootstrap
// * error logging via Analytics.logEvent on componentDidCatch
//
// -@jasoncrawford 2 Dec 2019

export class ExploreView extends React.Component<{ bounds: Bounds }> {
    static bootstrap({ containerNode }: { containerNode: HTMLElement }) {
        const rect = containerNode.getBoundingClientRect()
        const bounds = Bounds.fromRect(rect)
        return ReactDOM.render(<ExploreView bounds={bounds} />, containerNode)
    }

    render() {
        const chart = new ChartConfig()
        chart.update(DUMMY_JSON_CONFIG)
        return (
            <div>
                <ChartView chart={chart} bounds={this.props.bounds} />
            </div>
        )
    }
}
