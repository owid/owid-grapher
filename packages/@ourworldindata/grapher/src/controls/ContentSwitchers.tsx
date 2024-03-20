import React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import classnames from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faTable, faEarthAmericas } from "@fortawesome/free-solid-svg-icons"
import {
    ChartTypeName,
    GrapherTabOption,
    TimeBound,
} from "@ourworldindata/types"
import { chartIcons } from "./ChartIcons"
import { TimelineController } from "../timeline/TimelineController"

export interface ContentSwitchersManager {
    availableTabs?: GrapherTabOption[]
    tab?: GrapherTabOption
    isNarrow?: boolean
    type?: ChartTypeName
    isLineChart?: boolean
    isLineChartThatTurnedIntoDiscreteBar?: boolean
    timelineController?: TimelineController
}

enum DisplayOnlyTab {
    line = "line",
    bar = "bar",
}

type DisplayTab = GrapherTabOption | DisplayOnlyTab

@observer
export class ContentSwitchers extends React.Component<{
    manager: ContentSwitchersManager
}> {
    @computed private get manager(): ContentSwitchersManager {
        return this.props.manager
    }

    @computed private get availableTabs(): GrapherTabOption[] {
        return this.manager.availableTabs || []
    }

    @computed get displayedTabs(): DisplayTab[] {
        if (
            this.manager.isLineChart &&
            this.availableTabs.includes(GrapherTabOption.chart)
        ) {
            const tabs: DisplayTab[] = this.availableTabs.filter(
                (tab) => tab !== GrapherTabOption.chart
            )
            tabs.push(DisplayOnlyTab.line, DisplayOnlyTab.bar)
            return tabs
        }
        return this.availableTabs
    }

    @computed private get showTabLabels(): boolean {
        return !this.manager.isNarrow
    }

    @computed private get chartType(): ChartTypeName {
        return this.manager.type ?? ChartTypeName.LineChart
    }

    private tabIcon(tab: DisplayTab): JSX.Element {
        const { manager } = this
        switch (tab) {
            case "table":
                return <FontAwesomeIcon icon={faTable} />
            case "map":
                return <FontAwesomeIcon icon={faEarthAmericas} />
            case "chart":
                const chartIcon = manager.isLineChartThatTurnedIntoDiscreteBar
                    ? chartIcons[ChartTypeName.DiscreteBar]
                    : chartIcons[this.chartType]
                return chartIcon
            case "line":
                return chartIcons[ChartTypeName.LineChart]
            case "bar":
                return chartIcons[ChartTypeName.DiscreteBar]
            default:
                return <FontAwesomeIcon icon={faTable} />
        }
    }

    render(): JSX.Element {
        const { manager } = this
        return (
            <ul
                className={classnames({
                    ContentSwitchers: true,
                    iconOnly: !this.showTabLabels,
                })}
            >
                {this.displayedTabs.map((tab) => (
                    <Tab
                        key={tab}
                        tab={tab}
                        icon={this.tabIcon(tab)}
                        isActive={
                            tab === manager.tab ||
                            (tab === "line" &&
                                manager.tab === GrapherTabOption.chart &&
                                !manager.isLineChartThatTurnedIntoDiscreteBar) ||
                            (tab === "bar" &&
                                manager.isLineChartThatTurnedIntoDiscreteBar)
                        }
                        onClick={(): void => {
                            if (
                                tab === GrapherTabOption.map ||
                                tab === GrapherTabOption.table
                            ) {
                                manager.tab = tab
                            } else {
                                const { endTime } =
                                    manager.timelineController ?? {}

                                if (tab === "bar") {
                                    if (endTime !== undefined) {
                                        manager.timelineController?.updateStartTime(
                                            endTime
                                        )
                                        manager.timelineController?.updateEndTime(
                                            endTime
                                        )
                                    }
                                }
                                manager.tab = GrapherTabOption.chart
                            }
                        }}
                        showLabel={this.showTabLabels}
                    />
                ))}
            </ul>
        )
    }
}

function Tab(props: {
    tab: DisplayTab
    icon: JSX.Element
    isActive?: boolean
    onClick?: React.MouseEventHandler<HTMLButtonElement>
    showLabel?: boolean
}): JSX.Element {
    const className = "tab clickable" + (props.isActive ? " active" : "")
    return (
        <li key={props.tab} className={className}>
            <button
                onClick={props.onClick}
                data-track-note={"chart_click_" + props.tab}
                aria-label={props.tab}
            >
                {props.icon}
                {props.showLabel && <span className="label">{props.tab}</span>}
            </button>
        </li>
    )
}
