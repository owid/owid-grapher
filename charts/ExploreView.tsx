import * as React from "react"
import * as ReactDOM from "react-dom"
import { observable, computed, autorun } from "mobx"
import { observer } from "mobx-react"
import { Dictionary, extend } from "lodash"

import { Bounds } from "./Bounds"
import { ChartView } from "./ChartView"
import { ChartConfig, ChartConfigProps } from "./ChartConfig"
import { ChartType, ChartTypeType, ChartTypeDefsByKey } from "./ChartType"

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
    "WorldMap"
]

const CHART_TYPE_DEFS: Dictionary<{ key: string; label: string }> = {
    ...ChartTypeDefsByKey,
    WorldMap: { key: "WorldMap", label: "Map" }
}

function chartTypeLabel(type: string): string {
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

@observer
export class ExploreView extends React.Component<{ bounds: Bounds }> {
    static bootstrap({ containerNode }: { containerNode: HTMLElement }) {
        const rect = containerNode.getBoundingClientRect()
        const bounds = Bounds.fromRect(rect)
        return ReactDOM.render(<ExploreView bounds={bounds} />, containerNode)
    }

    @observable chartType: string = ChartType.LineChart

    chart: ChartConfig

    constructor(props: { bounds: Bounds }) {
        super(props)

        const chartProps = new ChartConfigProps()
        extend(chartProps, DUMMY_JSON_CONFIG)
        this.chart = new ChartConfig(chartProps)

        autorun(() => {
            this.chart.tab = this.tab
            this.chart.props.type = this.configChartType
            this.chart.props.hasMapTab = this.isMap
            this.chart.props.hasChartTab = !this.isMap
        })
    }

    @computed get bounds() {
        return this.props.bounds
    }

    @computed get isMap() {
        return this.chartType === "WorldMap"
    }

    @computed get tab() {
        return this.isMap ? "map" : "chart"
    }

    @computed get configChartType(): ChartTypeType {
        return this.isMap
            ? ChartType.LineChart
            : (this.chartType as ChartTypeType)
    }

    renderChartTypeButton(type: string) {
        return (
            <button
                key={type}
                className="chart-type-button"
                onClick={() => {
                    this.chartType = type
                }}
            >
                {chartTypeLabel(type)}
            </button>
        )
    }

    renderChartTypes() {
        return (
            <div className="chart-type-buttons">
                {AVAILABLE_CHART_TYPES.map(type =>
                    this.renderChartTypeButton(type)
                )}
            </div>
        )
    }

    render() {
        return (
            <div>
                {this.renderChartTypes()}
                <ChartView chart={this.chart} bounds={this.bounds} />
            </div>
        )
    }
}
