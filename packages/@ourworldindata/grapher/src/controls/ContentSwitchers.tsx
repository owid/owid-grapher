import * as React from "react"
import { action, computed } from "mobx"
import { observer } from "mobx-react"
import classnames from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faTable, faEarthAmericas } from "@fortawesome/free-solid-svg-icons"
import { chartIcons } from "./ChartIcons"
import { Bounds } from "@ourworldindata/utils"
import { TabLabel, Tabs } from "../tabs/Tabs.js"
import { GrapherTabName } from "../core/GrapherConstants"

export interface ContentSwitchersManager {
    availableTabs?: GrapherTabName[]
    activeTab?: GrapherTabName
    hasMultipleChartTypes?: boolean
    setTab: (tab: GrapherTabName) => void
    onTabChange: (oldTab: GrapherTabName, newTab: GrapherTabName) => void
    isNarrow?: boolean
    isMedium?: boolean
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

    @computed private get availableTabs(): GrapherTabName[] {
        return this.manager.availableTabs || []
    }

    @computed private get showTabs(): boolean {
        return this.availableTabs.length > 1
    }

    @computed private get showTabLabels(): boolean {
        return !this.manager.isNarrow
    }

    @computed get width(): number {
        return this.availableTabs.reduce((totalWidth, tab) => {
            // keep in sync with ContentSwitcher.scss
            const outerPadding =
                this.showTabLabels && this.manager.isMedium ? 8 : 16

            let tabWidth = 2 * outerPadding + ICON_WIDTH

            if (this.showTabLabels) {
                const tabLabel = makeTabLabelText(tab, {
                    hasMultipleChartTypes: this.manager.hasMultipleChartTypes,
                    isLineChartThatTurnedIntoDiscreteBar:
                        this.manager.isLineChartThatTurnedIntoDiscreteBar,
                })
                const labelWidth = Bounds.forText(tabLabel, {
                    fontSize: TAB_FONT_SIZE,
                }).width
                tabWidth += labelWidth + ICON_PADDING
            }

            return totalWidth + tabWidth
        }, 0)
    }

    @computed private get tabLabels(): TabLabel[] {
        return this.availableTabs.map((tab) => ({
            element: (
                <ContentSwitcherTab
                    key={tab}
                    tab={tab}
                    showLabel={this.showTabLabels}
                    hasMultipleChartTypes={this.manager.hasMultipleChartTypes}
                    isLineChartThatTurnedIntoDiscreteBar={
                        this.manager.isLineChartThatTurnedIntoDiscreteBar
                    }
                />
            ),
            buttonProps: {
                "data-track-note": "chart_click_" + tab,
                "aria-label": tab,
            },
        }))
    }

    @computed private get activeTabIndex(): number {
        const { activeTab } = this.manager
        if (!activeTab) return 0
        const activeIndex = this.availableTabs.indexOf(activeTab)
        return activeIndex >= 0 ? activeIndex : 0
    }

    @action.bound setTab(tabIndex: number): void {
        const oldTab = this.manager.activeTab
        const newTab = this.availableTabs[tabIndex]
        this.manager.setTab(newTab)
        this.manager.onTabChange?.(oldTab!, newTab)
    }

    render(): React.ReactElement {
        return (
            <Tabs
                variant="slim"
                extraClassNames={classnames("ContentSwitchers", {
                    iconOnly: !this.showTabLabels,
                })}
                labels={this.tabLabels}
                activeIndex={this.activeTabIndex}
                setActiveIndex={this.setTab}
            />
        )
    }
}

function ContentSwitcherTab({
    tab,
    showLabel,
    hasMultipleChartTypes,
    isLineChartThatTurnedIntoDiscreteBar,
}: {
    tab: GrapherTabName
    showLabel?: boolean
    hasMultipleChartTypes?: boolean
    isLineChartThatTurnedIntoDiscreteBar?: boolean
}): React.ReactElement {
    return (
        <span>
            <TabIcon
                tab={tab}
                isLineChartThatTurnedIntoDiscreteBar={
                    isLineChartThatTurnedIntoDiscreteBar
                }
            />
            {showLabel && (
                <span className="label">
                    {makeTabLabelText(tab, {
                        isLineChartThatTurnedIntoDiscreteBar,
                        hasMultipleChartTypes,
                    })}
                </span>
            )}
        </span>
    )
}

function TabIcon({
    tab,
    isLineChartThatTurnedIntoDiscreteBar,
}: {
    tab: GrapherTabName
    isLineChartThatTurnedIntoDiscreteBar?: boolean
}): React.ReactElement {
    switch (tab) {
        case "Table":
            return <FontAwesomeIcon icon={faTable} />
        case "WorldMap":
            return <FontAwesomeIcon icon={faEarthAmericas} />
        default: {
            const chartIcon =
                tab === "LineChart" && isLineChartThatTurnedIntoDiscreteBar
                    ? chartIcons.DiscreteBar
                    : chartIcons[tab]
            return chartIcon
        }
    }
}

function makeTabLabelText(
    tab: GrapherTabName,
    options: {
        isLineChartThatTurnedIntoDiscreteBar?: boolean
        hasMultipleChartTypes?: boolean
    }
): string {
    if (tab === "Table") return "Table"
    if (tab === "WorldMap") return "Map"
    if (!options.hasMultipleChartTypes) return "Chart"

    if (tab === "LineChart" && options.isLineChartThatTurnedIntoDiscreteBar)
        return "Bar"

    switch (tab) {
        case "LineChart":
            return "Line"
        case "SlopeChart":
            return "Slope"

        // chart type labels are preliminary
        case "ScatterPlot":
            return "Scatter"
        case "StackedArea":
            return "Stacked area"
        case "StackedBar":
            return "Stacked bar"
        case "DiscreteBar":
            return "Bar"
        case "StackedDiscreteBar":
            return "Stacked bar"
        case "Marimekko":
            return "Marimekko"
        default:
            return "Chart"
    }
}
