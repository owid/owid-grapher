import * as React from "react"
import * as ReactDOM from "react-dom"
import { computed, autorun } from "mobx"
import { observer } from "mobx-react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { IconDefinition } from "@fortawesome/fontawesome-svg-core"
import { faChartLine } from "@fortawesome/free-solid-svg-icons/faChartLine"
import { faChartBar } from "@fortawesome/free-solid-svg-icons/faChartBar"
import { faChartArea } from "@fortawesome/free-solid-svg-icons/faChartArea"
import { faMap } from "@fortawesome/free-solid-svg-icons/faMap"

import { Bounds } from "charts/utils/Bounds"
import { ChartView } from "charts/core/ChartView"
import { ChartType } from "charts/core/ChartConstants"
import { ExplorerViewContext } from "./ExplorerViewContext"
import { IndicatorDropdown } from "./IndicatorDropdown"
import { RootStore } from "explorer/indicatorExplorer/Store"
import { ExploreModel, ExplorerChartType } from "./ExploreModel"
import { DataTable } from "charts/dataTable/DataTable"
import { Analytics } from "site/client/Analytics"
import { UrlBinder } from "charts/utils/UrlBinder"

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
        const model = new ExploreModel(store)
        model.populateFromQueryStr(queryStr)
        return ReactDOM.render(
            <ExploreView bounds={bounds} model={model} />,
            containerNode
        )
    }

    componentWillUnmount() {
        this.model.dispose()
    }

    @computed get model() {
        return this.props.model
    }

    @computed get chart() {
        return this.model.chart
    }

    @computed get bounds() {
        return this.props.bounds
    }

    get childContext() {
        return {
            store: this.model.store
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
                    this.model.setChartType(button.type)
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
                    indicatorEntry={this.model.indicatorEntry}
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
                </div>
                <div>
                    <DataTable chart={this.chart} />
                </div>
            </ExplorerViewContext.Provider>
        )
    }

    bindToWindow() {
        new UrlBinder().bindToWindow(this.model.url)

        // We ignore the disposer here, because this reaction lasts for the
        // lifetime of the window. -@jasoncrawford 2019-12-16
        autorun(() => (document.title = this.chart.currentTitle))
    }

    componentDidCatch(error: any, info: any) {
        Analytics.logExploreError(error, info)
    }
}
