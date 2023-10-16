import React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import classnames from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faTable, faEarthAmericas } from "@fortawesome/free-solid-svg-icons"
import { ChartTypeName, GrapherTabOption } from "../core/GrapherConstants"
import { chartIcons } from "./ChartIcons"

export interface ContentSwitchersManager {
    availableTabs?: GrapherTabOption[]
    tab?: GrapherTabOption
    isNarrow?: boolean
    type?: ChartTypeName
    isLineChartThatTurnedIntoDiscreteBar?: boolean
    isAuthoredAsLineChartThatTurnedIntoDiscreteBar?: boolean
}

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

    @computed private get showTabLabels(): boolean {
        return !this.manager.isNarrow
    }

    @computed private get chartType(): ChartTypeName {
        return this.manager.type ?? ChartTypeName.LineChart
    }

    private previousChartIcon: JSX.Element | undefined

    private tabIcon(tab: GrapherTabOption): JSX.Element {
        const { manager } = this
        switch (tab) {
            case GrapherTabOption.table:
                return <FontAwesomeIcon icon={faTable} />
            case GrapherTabOption.map:
                return <FontAwesomeIcon icon={faEarthAmericas} />
            case GrapherTabOption.chart:
                let chartIcon = manager.isLineChartThatTurnedIntoDiscreteBar
                    ? chartIcons[ChartTypeName.DiscreteBar]
                    : chartIcons[this.chartType]
                // If we're switching from a line chart to the map, then the timeline
                // is automatically set to a single year, and the underlying chart switches to
                // a discrete bar chart, which makes the line chart icon change into a bar chart icon.
                // To prevent that, we hold onto the previous chart icon if we're not currently on the chart tab.
                if (manager.tab !== GrapherTabOption.chart) {
                    // make sure we're showing the line chart icon on first load
                    // if the chart is configured to be a line chart initially
                    if (
                        !this.previousChartIcon &&
                        this.chartType === ChartTypeName.LineChart &&
                        !manager.isAuthoredAsLineChartThatTurnedIntoDiscreteBar
                    ) {
                        chartIcon = chartIcons[ChartTypeName.LineChart]
                    } else if (this.previousChartIcon) {
                        chartIcon = this.previousChartIcon
                    }
                }
                this.previousChartIcon = chartIcon
                return chartIcon
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
                {this.availableTabs.map((tab) => (
                    <Tab
                        key={tab}
                        tab={tab}
                        icon={this.tabIcon(tab)}
                        isActive={tab === manager.tab}
                        onClick={(): void => {
                            manager.tab = tab
                        }}
                        showLabel={this.showTabLabels}
                    />
                ))}
            </ul>
        )
    }
}

function Tab(props: {
    tab: GrapherTabOption
    icon: JSX.Element
    isActive?: boolean
    onClick?: React.MouseEventHandler<HTMLAnchorElement>
    showLabel?: boolean
}): JSX.Element {
    const className = "tab clickable" + (props.isActive ? " active" : "")
    return (
        <li key={props.tab} className={className}>
            <a
                onClick={props.onClick}
                data-track-note={"chart_click_" + props.tab}
            >
                {props.icon}
                {props.showLabel && <span className="label">{props.tab}</span>}
            </a>
        </li>
    )
}
