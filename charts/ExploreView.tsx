import * as React from "react"
import * as ReactDOM from "react-dom"
import {
    observable,
    computed,
    IReactionDisposer,
    reaction,
    autorun
} from "mobx"
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
import { IndicatorStore } from "./IndicatorStore"
import { IndicatorDropdown } from "./IndicatorDropdown"
import { Indicator } from "./Indicator"

function chartConfigFromIndicator(
    indicator: Indicator
): Partial<ChartConfigProps> {
    return indicator
}

const WorldMap = "WorldMap"

type ExplorerChartType = ChartTypeType | "WorldMap"

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
}

@observer
export class ExploreView extends React.Component<ExploreProps> {
    static bootstrap({ containerNode }: { containerNode: HTMLElement }) {
        const rect = containerNode.getBoundingClientRect()
        const bounds = Bounds.fromRect(rect)
        return ReactDOM.render(<ExploreView bounds={bounds} />, containerNode)
    }

    // This is different from the chart's concept of chart type because it includes "WorldMap" as
    // an option, and doesn't include certain chart types we don't support right now, such as
    // scatter plots
    @observable.ref chartType: ExplorerChartType = ChartType.LineChart

    // TODO: Inidialize indicatorId from URL query paramter
    @observable.ref indicatorId?: number = 677

    chart: ChartConfig

    disposers!: IReactionDisposer[]

    constructor(props: ExploreProps) {
        super(props)

        const chartProps = new ChartConfigProps()
        this.chart = new ChartConfig(chartProps)
    }

    componentDidMount() {
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

            reaction(
                () => this.indicatorId,
                async indicatorId => {
                    if (indicatorId) {
                        const indicator = await this.childContext.indicatorStore.get(
                            indicatorId
                        )
                        // Indicator may have been switched while awaiting the promise
                        if (indicator && this.indicatorId === indicatorId) {
                            this.chart.update(
                                chartConfigFromIndicator(indicator)
                            )
                        }
                    } else {
                        // TODO need to handle case when indicator is cleared
                    }
                },
                { fireImmediately: true }
            )
        ]
    }

    componentWillUnmount() {
        this.disposers.forEach(dispose => dispose())
    }

    @computed get bounds() {
        return this.props.bounds
    }

    @computed get isMap() {
        return this.chartType === "WorldMap"
    }

    // Translates between the chart type chosen in the Explore UI, and the type we want to set on
    // the ChartConfigProps. It's a pass-through unless map is chosen, in which case we tell the
    // chart (arbitrarily) to be a line chart, and set the tab to map.
    @computed get configChartType(): ChartTypeType {
        return this.isMap
            ? ChartType.LineChart
            : (this.chartType as ChartTypeType)
    }

    renderChartTypeButton(type: ExplorerChartType) {
        const isSelected = type === this.chartType
        const display = CHART_TYPE_DISPLAY[type]
        return (
            <button
                key={type}
                data-type={type}
                className={`chart-type-button ${isSelected ? "selected" : ""}`}
                onClick={() => {
                    this.chartType = type
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
                    placeholder="Select X axis variable"
                    onChangeId={id => (this.indicatorId = id)}
                    selectedId={this.indicatorId}
                />
            </div>
        )
    }

    get childContext() {
        return {
            indicatorStore: new IndicatorStore()
        }
    }

    render() {
        return (
            <ExplorerViewContext.Provider value={this.childContext}>
                <div>
                    {this.renderChartTypes()}
                    {this.renderIndicatorSwitching()}
                    <ChartView chart={this.chart} bounds={this.bounds} />
                </div>
            </ExplorerViewContext.Provider>
        )
    }
}
