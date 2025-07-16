import * as React from "react"
import { action, computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import classnames from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faTable, faEarthAmericas } from "@fortawesome/free-solid-svg-icons"
import {
    GRAPHER_CHART_TYPES,
    GrapherTabName,
    GRAPHER_TAB_NAMES,
} from "@ourworldindata/types"
import { chartIcons } from "./ChartIcons"
import { TabLabel, Tabs } from "../tabs/Tabs.js"

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

@observer
export class ContentSwitchers extends React.Component<{
    manager: ContentSwitchersManager
}> {
    constructor(props: { manager: ContentSwitchersManager }) {
        super(props)
        makeObservable(this)
    }

    static shouldShow(manager: ContentSwitchersManager): boolean {
        const test = new ContentSwitchers({ manager })
        return test.shouldShow
    }

    @computed private get manager(): ContentSwitchersManager {
        return this.props.manager
    }

    @computed private get availableTabs(): GrapherTabName[] {
        return this.manager.availableTabs || []
    }

    @computed private get shouldShow(): boolean {
        return this.availableTabs.length > 1
    }

    @computed private get showTabLabels(): boolean {
        return !this.manager.isNarrow
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

    render(): React.ReactElement | null {
        if (!this.shouldShow) return null

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
        case GRAPHER_TAB_NAMES.Table:
            return <FontAwesomeIcon icon={faTable} />
        case GRAPHER_TAB_NAMES.WorldMap:
            return <FontAwesomeIcon icon={faEarthAmericas} />
        default: {
            const chartIcon =
                tab === GRAPHER_TAB_NAMES.LineChart &&
                isLineChartThatTurnedIntoDiscreteBar
                    ? chartIcons[GRAPHER_CHART_TYPES.DiscreteBar]
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
    if (tab === GRAPHER_TAB_NAMES.Table) return "Table"
    if (tab === GRAPHER_TAB_NAMES.WorldMap) return "Map"
    if (!options.hasMultipleChartTypes) return "Chart"

    if (
        tab === GRAPHER_TAB_NAMES.LineChart &&
        options.isLineChartThatTurnedIntoDiscreteBar
    )
        return "Bar"

    switch (tab) {
        case GRAPHER_TAB_NAMES.LineChart:
            return "Line"
        case GRAPHER_TAB_NAMES.SlopeChart:
            return "Slope"

        // chart type labels are preliminary
        case GRAPHER_TAB_NAMES.ScatterPlot:
            return "Scatter"
        case GRAPHER_TAB_NAMES.StackedArea:
            return "Stacked area"
        case GRAPHER_TAB_NAMES.StackedBar:
            return "Stacked bar"
        case GRAPHER_TAB_NAMES.DiscreteBar:
            return "Bar"
        case GRAPHER_TAB_NAMES.StackedDiscreteBar:
            return "Stacked bar"
        case GRAPHER_TAB_NAMES.Marimekko:
            return "Marimekko"
        default:
            return "Chart"
    }
}
