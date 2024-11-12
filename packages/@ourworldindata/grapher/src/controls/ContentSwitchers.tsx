import React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import classnames from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faTable, faEarthAmericas } from "@fortawesome/free-solid-svg-icons"
import { ChartTypeName, GrapherTabOption } from "@ourworldindata/types"
import { chartIcons } from "./ChartIcons"
import { Bounds, capitalize } from "@ourworldindata/utils"
import { TabLabel, Tabs } from "../tabs/Tabs.js"

export interface ContentSwitchersManager {
    sortedAvailableTabs?: GrapherTabOption[]
    tab?: GrapherTabOption
    currentTab?: GrapherTabOption
    isNarrow?: boolean
    isMedium?: boolean
    currentChartType?: ChartTypeName
    isLineChartThatTurnedIntoDiscreteBar?: boolean
}

// keep in sync with Tabs.scss
const TAB_FONT_SIZE = 13

// keep in sync with ContentSwitcher.scss
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
        return this.manager.sortedAvailableTabs || []
    }

    @computed private get showTabs(): boolean {
        return this.availableTabs.length > 1
    }

    @computed private get showTabLabels(): boolean {
        return !this.manager.isNarrow
    }

    @computed private get chartType(): ChartTypeName {
        return this.manager.currentChartType ?? ChartTypeName.LineChart
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

    private getTabIcon(tab: GrapherTabOption): React.ReactElement {
        const { manager } = this
        switch (tab) {
            case GrapherTabOption.Table:
                return <FontAwesomeIcon icon={faTable} />
            case GrapherTabOption.WorldMap:
                return <FontAwesomeIcon icon={faEarthAmericas} />
            default:
                const chartIcon = manager.isLineChartThatTurnedIntoDiscreteBar
                    ? chartIcons[ChartTypeName.DiscreteBar]
                    : chartIcons[this.chartType]
                return chartIcon
        }
    }

    private getTabTextLabel(tab: GrapherTabOption): string {
        switch (tab) {
            case GrapherTabOption.Table:
                return "Table"
            case GrapherTabOption.WorldMap:
                return "Map"
            case GrapherTabOption.LineChart:
                return "Line"
            case GrapherTabOption.SlopeChart:
                return "Slope"
            default:
                return "Chart"
        }
    }

    private getTrackingKey(tab: GrapherTabOption): string {
        switch (tab) {
            case GrapherTabOption.Table:
                return "chart_click_table"
            case GrapherTabOption.WorldMap:
                return "chart_click_map"
            case GrapherTabOption.LineChart:
                return "chart_click_line"
            case GrapherTabOption.SlopeChart:
                return "chart_click_slope"
            default:
                return "chart_click_chart"
        }
    }

    private getAriaLabel(tab: GrapherTabOption): string {
        switch (tab) {
            case GrapherTabOption.Table:
                return "Table"
            case GrapherTabOption.WorldMap:
                return "Map"
            case GrapherTabOption.LineChart:
                return "Line chart"
            case GrapherTabOption.SlopeChart:
                return "Slope chart"
            default:
                return "Chart"
        }
    }

    @computed private get tabLabels(): TabLabel[] {
        return this.availableTabs.map((tab) => ({
            element: (
                <span key={tab}>
                    {this.getTabIcon(tab)}
                    {this.showTabLabels && (
                        <span className="label">
                            {this.getTabTextLabel(tab)}
                        </span>
                    )}
                </span>
            ),
            buttonProps: {
                "data-track-note": this.getTrackingKey(tab),
                "aria-label": this.getAriaLabel(tab),
            },
        }))
    }

    render(): React.ReactElement {
        const { manager, tabLabels } = this

        const activeIndex =
            (manager.currentTab &&
                this.availableTabs.indexOf(manager.currentTab)) ??
            0

        return (
            <Tabs
                variant="slim"
                extraClassNames={classnames("ContentSwitchers", {
                    iconOnly: !this.showTabLabels,
                })}
                labels={tabLabels}
                activeIndex={activeIndex}
                setActiveIndex={(index) =>
                    (manager.tab = this.availableTabs[index])
                }
            />
        )
    }
}
