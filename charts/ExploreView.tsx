import * as React from "react"
import * as ReactDOM from "react-dom"
import { observable, computed, autorun, IReactionDisposer } from "mobx"
import { observer } from "mobx-react"
import { extend } from "lodash"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { IconDefinition } from "@fortawesome/fontawesome-svg-core"
import { faChartLine } from "@fortawesome/free-solid-svg-icons/faChartLine"
import { faChartBar } from "@fortawesome/free-solid-svg-icons/faChartBar"
import { faChartArea } from "@fortawesome/free-solid-svg-icons/faChartArea"
import { faMap } from "@fortawesome/free-solid-svg-icons/faMap"

import { Bounds } from "./Bounds"
import { ChartView } from "./ChartView"
import { ChartConfig, ChartConfigProps } from "./ChartConfig"
import { ChartType, ChartTypeType } from "./ChartType"
import * as urlBinding from "charts/UrlBinding"
import { ExploreUrl } from "./ExploreUrl"
import { ExploreModel, ExplorerChartType } from "./ExploreModel"
import { DataTable } from "./DataTable"

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
    selectedData: [{ index: 0, entityId: 355 }],
    map: { targetYear: 2017 }
}

const WorldMap = "WorldMap"

const AVAILABLE_CHART_TYPES: ExplorerChartType[] = [
    ChartType.LineChart,
    ChartType.StackedArea,
    ChartType.StackedBar,
    ChartType.DiscreteBar,
    ChartType.SlopeChart,
    WorldMap
]

const CHART_TYPE_DISPLAY: {
    [key: string]: { label: string; icon: IconDefinition }
} = {
    [ChartType.LineChart]: { label: "Line", icon: faChartLine },
    [ChartType.StackedArea]: { label: "Area", icon: faChartArea },
    [ChartType.StackedBar]: { label: "Stacked", icon: faChartBar },
    [ChartType.DiscreteBar]: { label: "Bar", icon: faChartBar },
    [ChartType.SlopeChart]: { label: "Slope", icon: faChartLine },
    [WorldMap]: { label: "Map", icon: faMap }
}

// This component was modeled after ChartView.
//
// TODO that ChartView handles but this doesn't:
// * re-render on window resize event (throttled)
// * FullStory event logging on bootstrap
// * error logging via Analytics.logEvent on componentDidCatch
//
// -@jasoncrawford 2 Dec 2019

interface ExploreProps {
    bounds: Bounds
    queryStr?: string
}

@observer
export class ExploreView extends React.Component<ExploreProps> {
    static bootstrap({
        containerNode,
        queryStr
    }: {
        containerNode: HTMLElement
        queryStr?: string
    }) {
        const rect = containerNode.getBoundingClientRect()
        const bounds = Bounds.fromRect(rect)
        const view = ReactDOM.render(
            <ExploreView bounds={bounds} queryStr={queryStr} />,
            containerNode
        )
        return view
    }

    model: ExploreModel
    chart: ChartConfig
    url: ExploreUrl

    dispose!: IReactionDisposer

    constructor(props: ExploreProps) {
        super(props)

        const chartProps = new ChartConfigProps()
        extend(chartProps, DUMMY_JSON_CONFIG)
        this.chart = new ChartConfig(chartProps)

        this.model = new ExploreModel()

        this.url = new ExploreUrl(this.model, this.chart.url)
        this.url.populateFromQueryStr(this.props.queryStr)

        // We need these updates in an autorun because the chart config objects aren't really meant
        // to be recreated all the time. They aren't pure value objects and have behaviors on
        // instantiation that include fetching data over the network. Instead, we rely on their
        // observable properties, and on this autorun block to connect them to the Explore controls.
        // -@jasoncrawford 2019-12-04
        this.dispose = autorun(() => {
            this.chart.props.type = this.configChartType
            this.chart.props.hasMapTab = this.isMap
            this.chart.props.hasChartTab = !this.isMap
            this.chart.tab = this.tab
        })
    }

    componentWillUnmount() {
        this.dispose()
    }

    @computed get bounds() {
        return this.props.bounds
    }

    @computed get isMap() {
        return this.model.chartType === "WorldMap"
    }

    @computed get tab() {
        return this.isMap ? "map" : "chart"
    }

    // Translates between the chart type chosen in the Explore UI, and the type we want to set on
    // the ChartConfigProps. It's a pass-through unless map is chosen, in which case we tell the
    // chart (arbitrarily) to be a line chart, and set the tab to map.
    @computed get configChartType(): ChartTypeType {
        return this.isMap
            ? ChartType.LineChart
            : (this.model.chartType as ChartTypeType)
    }

    renderChartTypeButton(type: ExplorerChartType) {
        const isSelected = type === this.model.chartType
        const display = CHART_TYPE_DISPLAY[type]
        return (
            <button
                key={type}
                data-type={type}
                className={`chart-type-button ${isSelected ? "selected" : ""}`}
                onClick={() => {
                    this.model.chartType = type
                }}
            >
                <FontAwesomeIcon icon={display.icon} />
                <div>{display.label}</div>
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
                <DataTable chart={this.chart} />
            </div>
        )
    }

    bindToWindow() {
        urlBinding.bindUrlToWindow(this.url)
        autorun(() => (document.title = this.chart.data.currentTitle))
    }
}
