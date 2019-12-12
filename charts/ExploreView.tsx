import * as React from "react"
import * as ReactDOM from "react-dom"
import { observable, computed, IReactionDisposer, autorun } from "mobx"
import { observer } from "mobx-react"
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
import { ExplorerViewContext } from "./ExplorerViewContext"
import { IndicatorDropdown } from "./IndicatorDropdown"
import { Indicator } from "./Indicator"
import { RootStore, StoreEntry } from "./Store"
import * as urlBinding from "charts/UrlBinding"
import { ExploreUrl } from "./ExploreUrl"
import { ExploreModel, ExplorerChartType } from "./ExploreModel"
import { DataTable } from "./DataTable"

function chartConfigFromIndicator(
    indicator: Indicator
): Partial<ChartConfigProps> {
    return {
        ...indicator,
        // TODO need to derive selected data from ExploreModel, since selections
        // should persist when switching indicators.
        selectedData: [
            {
                index: 0,
                entityId: 355
            }
        ]
    }
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
    model: ExploreModel
    store: RootStore
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
        const store = new RootStore()
        const model = new ExploreModel()
        return ReactDOM.render(
            <ExploreView
                bounds={bounds}
                model={model}
                store={store}
                queryStr={queryStr}
            />,
            containerNode
        )
    }

    model: ExploreModel
    chart: ChartConfig
    url: ExploreUrl

    disposers: IReactionDisposer[]

    constructor(props: ExploreProps) {
        super(props)

        const chartProps = new ChartConfigProps()
        this.chart = new ChartConfig(chartProps)

        this.model = this.props.model

        this.url = new ExploreUrl(this.model, this.chart.url)
        this.url.populateFromQueryStr(this.props.queryStr)

        this.disposers = [
            // We need these updates in an autorun because the chart config objects aren't really meant
            // to be recreated all the time. They aren't pure value objects and have behaviors on
            // instantiation that include fetching data over the network. Instead, we rely on their
            // observable properties, and on this autorun block to connect them to the Explore controls.
            // -@jasoncrawford 2019-12-04
            autorun(() => {
                this.chart.props.type = this.configChartType
                this.chart.props.hasMapTab = this.isMap
                this.chart.props.hasChartTab = !this.isMap
                this.chart.tab = this.isMap ? "map" : "chart"
            }),

            autorun(() => {
                if (this.indicatorEntry === null) {
                    this.chart.update({ dimensions: [] })
                } else {
                    const indicator = this.indicatorEntry.entity
                    if (indicator) {
                        this.chart.update(chartConfigFromIndicator(indicator))
                    }
                }
            })
        ]
    }

    componentWillUnmount() {
        this.disposers.forEach(dispose => dispose())
    }

    @computed get indicatorEntry(): StoreEntry<Indicator> | null {
        if (this.model.indicatorId) {
            const indicatorEntry = this.childContext.store.indicators.get(
                this.model.indicatorId
            )
            return indicatorEntry
        }
        return null
    }

    @computed get bounds() {
        return this.props.bounds
    }

    @computed get isMap() {
        return this.model.chartType === "WorldMap"
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

    renderIndicatorSwitching() {
        return (
            <div className="indicator-bar">
                <IndicatorDropdown
                    placeholder="Select variable"
                    onChangeId={id => (this.model.indicatorId = id)}
                    indicatorEntry={this.indicatorEntry}
                />
            </div>
        )
    }

    get childContext() {
        return {
            store: this.props.store
        }
    }

    bindToWindow() {
        urlBinding.bindUrlToWindow(this.url)
        autorun(() => (document.title = this.chart.data.currentTitle))
    }

    render() {
        return (
            <ExplorerViewContext.Provider value={this.childContext}>
                <div>
                    {this.renderChartTypes()}
                    {this.renderIndicatorSwitching()}
                    <ChartView chart={this.chart} bounds={this.bounds} />
                    <DataTable chart={this.chart} />
                </div>
            </ExplorerViewContext.Provider>
        )
    }
}
