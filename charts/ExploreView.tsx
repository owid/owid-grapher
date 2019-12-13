import * as React from "react"
import * as ReactDOM from "react-dom"
import { computed, IReactionDisposer, autorun } from "mobx"
import { observer } from "mobx-react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { IconDefinition } from "@fortawesome/fontawesome-svg-core"
import { faChartLine } from "@fortawesome/free-solid-svg-icons/faChartLine"
import { faChartBar } from "@fortawesome/free-solid-svg-icons/faChartBar"
import { faChartArea } from "@fortawesome/free-solid-svg-icons/faChartArea"
import { faMap } from "@fortawesome/free-solid-svg-icons/faMap"

import { Bounds } from "./Bounds"
import { ChartView } from "./ChartView"
import { ChartConfigProps } from "./ChartConfig"
import { ChartType, ChartTypeType } from "./ChartType"
import { ExplorerViewContext } from "./ExplorerViewContext"
import { IndicatorDropdown } from "./IndicatorDropdown"
import { Indicator } from "./Indicator"
import { RootStore, StoreEntry } from "./Store"
import * as urlBinding from "charts/UrlBinding"
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

export interface ChartTypeButton {
    type: ExplorerChartType
    label: string
    icon: IconDefinition
}

const CHART_TYPE_BUTTONS: ChartTypeButton[] = [
    { type: ChartType.LineChart, label: "Line", icon: faChartLine },
    { type: ChartType.StackedArea, label: "Area", icon: faChartArea },
    { type: ChartType.StackedBar, label: "Stacked", icon: faChartBar },
    { type: ChartType.DiscreteBar, label: "Bar", icon: faChartBar },
    { type: ChartType.SlopeChart, label: "Slope", icon: faChartLine },
    { type: ExploreModel.WorldMap, label: "Map", icon: faMap }
]

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
        model.populateFromQueryStr(queryStr)
        return ReactDOM.render(
            <ExploreView bounds={bounds} model={model} store={store} />,
            containerNode
        )
    }

    disposers: IReactionDisposer[] = []

    constructor(props: ExploreProps) {
        super(props)

        this.disposers.push(
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
        )
    }

    componentWillUnmount() {
        this.disposers.forEach(dispose => dispose())
        this.model.dispose()
    }

    @computed get model() {
        return this.props.model
    }

    @computed get chart() {
        return this.model.chart
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

    get childContext() {
        return {
            store: this.props.store
        }
    }
    renderChartTypeButton(button: ChartTypeButton) {
        const isSelected = button.type === this.model.chartType
        return (
            <button
                key={button.type}
                data-type={button.type}
                className={`chart-type-button ${isSelected ? "selected" : ""}`}
                onClick={() => {
                    this.model.chartType = button.type
                }}
            >
                <FontAwesomeIcon icon={button.icon} />
                <div>{button.label}</div>
            </button>
        )
    }

    renderChartTypes() {
        return (
            <div className="chart-type-buttons">
                {CHART_TYPE_BUTTONS.map(button =>
                    this.renderChartTypeButton(button)
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

    bindToWindow() {
        urlBinding.bindUrlToWindow(this.model.url)
        autorun(() => (document.title = this.chart.data.currentTitle))
    }
}
