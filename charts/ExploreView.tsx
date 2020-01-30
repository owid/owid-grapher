import * as React from "react"
import * as ReactDOM from "react-dom"
import { computed, autorun, observable, runInAction } from "mobx"
import { observer } from "mobx-react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { IconDefinition } from "@fortawesome/fontawesome-svg-core"
import { faChartLine } from "@fortawesome/free-solid-svg-icons/faChartLine"
import { faChartBar } from "@fortawesome/free-solid-svg-icons/faChartBar"
import { faChartArea } from "@fortawesome/free-solid-svg-icons/faChartArea"
import { faMap } from "@fortawesome/free-solid-svg-icons/faMap"

import { Bounds } from "./Bounds"
import { ChartView } from "./ChartView"
import { ChartType } from "./ChartType"
import { ExplorerViewContext } from "./ExplorerViewContext"
import { IndicatorDropdown } from "./IndicatorDropdown"
import { RootStore } from "./Store"
import * as urlBinding from "charts/UrlBinding"
import { ExploreModel, ExplorerChartType } from "./ExploreModel"
import { DataTable } from "./DataTable"
import { Analytics } from "site/client/Analytics"
import { throttle } from "./Util"
import { bind } from "decko"

export interface ChartTypeButton {
    type: ExplorerChartType
    label: string
    icon: IconDefinition
}

const CHART_TYPE_BUTTONS: ChartTypeButton[] = [
    { type: ChartType.LineChart, label: "Line", icon: faChartLine },
    { type: ChartType.StackedArea, label: "Area", icon: faChartArea },
    { type: ChartType.StackedBar, label: "Stack", icon: faChartBar },
    { type: ChartType.DiscreteBar, label: "Bar", icon: faChartBar },
    { type: ChartType.SlopeChart, label: "Slope", icon: faChartLine },
    { type: ExploreModel.WorldMap, label: "Map", icon: faMap }
]

// This component was modeled after ChartView.
//
// TODO that ChartView handles but this doesn't:
// * FullStory event logging on bootstrap
// * error logging via Analytics.logEvent on componentDidCatch
//
// -@jasoncrawford 2 Dec 2019

interface ExploreProps {
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
        const store = new RootStore()
        const model = new ExploreModel(store)
        model.populateFromQueryStr(queryStr)
        return ReactDOM.render(<ExploreView model={model} />, containerNode)
    }

    @observable.ref chartViewNode: React.RefObject<
        HTMLDivElement
    > = React.createRef()
    @observable.ref chartViewBounds?: Bounds

    onResizeThrottled: () => void = () => null

    @bind onResize() {
        const el = this.chartViewNode.current
        if (el) {
            const rect = el.getBoundingClientRect()
            const bounds = Bounds.fromRect(rect)
            runInAction(() => {
                this.chartViewBounds = bounds
            })
        }
    }

    componentDidMount() {
        this.onResizeThrottled = throttle(this.onResize, 200, {
            leading: false,
            trailing: true
        })

        window.addEventListener("resize", this.onResizeThrottled)

        // Force initialization call
        this.onResize()
    }

    componentWillUnmount() {
        this.model.dispose()
        window.removeEventListener("resize", this.onResizeThrottled)
    }

    @computed get model() {
        return this.props.model
    }

    @computed get chart() {
        return this.model.chart
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
                    this.model.chartType = button.type
                }}
            >
                <div className="inner">
                    <div className="icon">
                        <FontAwesomeIcon icon={button.icon} />
                    </div>
                    <div className="label">{button.label}</div>
                </div>
            </button>
        )
    }

    renderChartTypeControl() {
        return (
            <div className="chart-type-control">
                {CHART_TYPE_BUTTONS.map(button =>
                    this.renderChartTypeButton(button)
                )}
            </div>
        )
    }

    renderIndicatorControl() {
        return (
            <div className="indicator-control">
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
                <div className="top-controls-container">
                    <div className="wrapper">
                        <div className="top-controls">
                            {this.renderIndicatorControl()}
                            {this.renderChartTypeControl()}
                        </div>
                    </div>
                </div>
                <div className="chart-view-container">
                    <div className="wrapper">
                        <div className="ChartView" ref={this.chartViewNode}>
                            {this.chartViewBounds && (
                                <ChartView
                                    chart={this.chart}
                                    bounds={this.chartViewBounds}
                                />
                            )}
                        </div>
                    </div>
                </div>
                <div className="data-table-container">
                    <div className="wrapper">
                        <DataTable chart={this.chart} />
                    </div>
                </div>
            </ExplorerViewContext.Provider>
        )
    }

    bindToWindow() {
        urlBinding.bindUrlToWindow(this.model.url)

        // We ignore the disposer here, because this reaction lasts for the
        // lifetime of the window. -@jasoncrawford 2019-12-16
        autorun(() => (document.title = this.chart.data.currentTitle))
    }

    componentDidCatch(error: any, info: any) {
        Analytics.logEvent("EXPLORE_ERROR", { error, info })
    }
}
