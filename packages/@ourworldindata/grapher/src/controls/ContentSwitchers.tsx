import React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import classnames from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faTable, faEarthAmericas } from "@fortawesome/free-solid-svg-icons"
import { ChartTypeName, GrapherTabOption } from "@ourworldindata/types"
import { chartIcons } from "./ChartIcons"
import { Bounds, capitalize } from "@ourworldindata/utils"

export interface ContentSwitchersManager {
    availableTabs?: GrapherTabOption[]
    tab?: GrapherTabOption
    isNarrow?: boolean
    isMedium?: boolean
    type: ChartTypeName
    isLineChartThatTurnedIntoDiscreteBar?: boolean
}

// keep in sync with ContentSwitcher.scss
const TAB_FONT_SIZE = 13
const ICON_WIDTH = 13
const ICON_PADDING = 6

@observer
export class ContentSwitchers extends React.Component<{
    manager: ContentSwitchersManager
}> {
    static shouldShow(manager: ContentSwitchersManager): boolean {
        const test = new ContentSwitchers({ manager })
        return test.showTabs
    }

    static width(manager: ContentSwitchersManager): number {
        const test = new ContentSwitchers({ manager })
        return test.width
    }

    @computed private get manager(): ContentSwitchersManager {
        return this.props.manager
    }

    @computed private get availableTabs(): GrapherTabOption[] {
        return this.manager.availableTabs || []
    }

    @computed private get showTabs(): boolean {
        return this.availableTabs.length > 1
    }

    @computed private get showTabLabels(): boolean {
        return !this.manager.isNarrow
    }

    @computed private get chartType(): ChartTypeName {
        return this.manager.type ?? ChartTypeName.LineChart
    }

    @computed get width(): number {
        return this.availableTabs.reduce((totalWidth, tab) => {
            // keep in sync with ContentSwitcher.scss
            const outerPadding =
                this.showTabLabels && this.manager.isMedium ? 8 : 16

            let tabWidth = 2 * outerPadding + ICON_WIDTH

            if (this.showTabLabels) {
                const labelWidth = Bounds.forText(capitalize(tab), {
                    fontSize: TAB_FONT_SIZE,
                }).width
                tabWidth += labelWidth + ICON_PADDING
            }

            return totalWidth + tabWidth
        }, 0)
    }

    private tabIcon(tab: GrapherTabOption): React.ReactElement {
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

    render(): React.ReactElement {
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
    icon: React.ReactElement
    isActive?: boolean
    onClick?: React.MouseEventHandler<HTMLButtonElement>
    showLabel?: boolean
}): React.ReactElement {
    const className = "tab clickable" + (props.isActive ? " active" : "")
    return (
        <li key={props.tab} className={className}>
            <button
                onClick={props.onClick}
                data-track-note={"chart_click_" + props.tab}
                aria-label={props.tab}
                type="button"
            >
                {props.icon}
                {props.showLabel && <span className="label">{props.tab}</span>}
            </button>
        </li>
    )
}
