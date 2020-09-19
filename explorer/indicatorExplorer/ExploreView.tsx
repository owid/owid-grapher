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
import { Bounds, DEFAULT_BOUNDS } from "grapher/utils/Bounds"
import { GrapherView } from "grapher/core/GrapherView"
import { ChartTypes } from "grapher/core/GrapherConstants"
import { ExplorerViewContext } from "./ExplorerViewContext"
import { IndicatorDropdown } from "./IndicatorDropdown"
import { RootStore } from "explorer/indicatorExplorer/Store"
import { ExploreModel, ExplorerChartType } from "./ExploreModel"
import { DataTable } from "grapher/dataTable/DataTable"
import { UrlBinder } from "grapher/utils/UrlBinder"

interface ChartTypeButton {
    type: ExplorerChartType
    label: string
    icon: IconDefinition
}

const CHART_TYPE_BUTTONS: ChartTypeButton[] = [
    { type: ChartTypes.LineChart, label: "Line", icon: faChartLine },
    { type: ChartTypes.StackedArea, label: "Area", icon: faChartArea },
    { type: ChartTypes.StackedBar, label: "Stacked", icon: faChartBar },
    { type: ChartTypes.DiscreteBar, label: "Bar", icon: faChartBar },
    { type: ChartTypes.SlopeChart, label: "Slope", icon: faChartLine },
    { type: ExploreModel.WorldMap, label: "Map", icon: faMap },
]

// This component was modeled after GrapherView.
//
// TODO that GrapherView handles but this doesn't:
// * re-render on window resize event (throttled)
// * FullStory event logging on bootstrap
// * error logging via Analytics.logEvent on componentDidCatch
//
// -@jasoncrawford 2 Dec 2019

interface ExploreProps {
    bounds?: Bounds
    model: ExploreModel
}

@observer
export class ExploreView extends React.Component<ExploreProps> {
    static bootstrap({
        containerNode,
        queryStr,
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

    @computed get grapher() {
        return this.model.grapher
    }

    @computed get bounds() {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    get childContext() {
        return {
            store: this.model.store,
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
                {CHART_TYPE_BUTTONS.map((button) =>
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
                    onChangeId={(id) => (this.model.indicatorId = id)}
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
                    <GrapherView grapher={this.grapher} bounds={this.bounds} />
                </div>
                <div>
                    <DataTable grapher={this.grapher} />
                </div>
            </ExplorerViewContext.Provider>
        )
    }

    bindToWindow() {
        new UrlBinder().bindToWindow(this.model.url)

        // We ignore the disposer here, because this reaction lasts for the
        // lifetime of the window. -@jasoncrawford 2019-12-16
        autorun(() => (document.title = this.grapher.currentTitle))
    }

    componentDidCatch(error: any, info: any) {
        this.grapher.analytics.logExploreError(error, info)
    }
}
