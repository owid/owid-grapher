import * as React from "react"
import * as ReactDOM from "react-dom"

import { Bounds } from "./Bounds"
import { ChartView } from "./ChartView"
import { ChartConfig } from "./ChartConfig"
import { ChartType, ChartTypeDefsByKey } from "./ChartType"

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

const AVAILABLE_CHART_TYPES = [
  ChartType.LineChart,
  ChartType.StackedArea,
  ChartType.StackedBar,
  ChartType.DiscreteBar,
  ChartType.SlopeChart,
  "Map",
]

const CHART_TYPE_DEFS = {...ChartTypeDefsByKey, "Map": {key: "Map", label: "Map"}}

function chartTypeLabel(type) {
  return CHART_TYPE_DEFS[type].label
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

    constructor(props) {
        super(props)
        this.state = {chart: new ChartConfig(DUMMY_JSON_CONFIG)}
    }

    onClickChartType(event, type) {
        let tab = (type === "Map") ? "map" : "chart"
        let hasMapTab = (tab === "map")
        let hasChartTab = (tab === "chart")
        let chart = new ChartConfig({...DUMMY_JSON_CONFIG, type, tab, hasMapTab, hasChartTab})
        this.setState({chart})
    }

    renderChartTypeButton(type) {
        return (
            <button key={type} className="chart-type-button" onClick={event => this.onClickChartType(event, type)}>
                {chartTypeLabel(type)}
            </button>
        )
    }

    renderChartTypes() {
        return <div className="chart-type-buttons">{AVAILABLE_CHART_TYPES.map(type => this.renderChartTypeButton(type))}</div>
    }

    render() {
        return <div>
            {this.renderChartTypes()}
            <ChartView chart={this.state.chart} bounds={this.props.bounds} />
        </div>
    }
}
