import React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import classnames from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faTable, faEarthAmericas } from "@fortawesome/free-solid-svg-icons"
import { ChartTypeName, GrapherTabOption } from "@ourworldindata/types"
import { chartIcons } from "./ChartIcons"

export interface ContentSwitchersManager {
    availableTabs?: GrapherTabOption[]
    tab?: GrapherTabOption
    isNarrow?: boolean
    type?: ChartTypeName
    isLineChartThatTurnedIntoDiscreteBar?: boolean
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

    private tabIcon(tab: GrapherTabOption): JSX.Element {
        const { manager } = this
        switch (tab) {
            case GrapherTabOption.table:
                return <FontAwesomeIcon icon={faTable} />
            case GrapherTabOption.map:
                return <FontAwesomeIcon icon={faEarthAmericas} />
            case GrapherTabOption.chart:
                const chartIcon = manager.isLineChartThatTurnedIntoDiscreteBar
                    ? chartIcons[ChartTypeName.DiscreteBar]
                    : chartIcons[this.chartType]
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
