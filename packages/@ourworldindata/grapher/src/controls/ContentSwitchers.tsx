import * as React from "react"
import { action, computed } from "mobx"
import { observer } from "mobx-react"
import classnames from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faTable, faEarthAmericas } from "@fortawesome/free-solid-svg-icons"
import { GrapherTabName, GRAPHER_TAB_NAMES } from "@ourworldindata/types"
import { chartIcons } from "./ChartIcons"
import { TabLabel, Tabs } from "../tabs/Tabs.js"
import { CHART_TYPE_LABEL } from "../chart/ChartTabs"

export interface ContentSwitchersManager {
    availableTabs?: GrapherTabName[]
    activeTab?: GrapherTabName
    hasMultipleChartTypes?: boolean
    setTab: (tab: GrapherTabName) => void
    onTabChange: (oldTab: GrapherTabName, newTab: GrapherTabName) => void
    isNarrow?: boolean
    isMedium?: boolean
}

@observer
export class ContentSwitchers extends React.Component<{
    manager: ContentSwitchersManager
}> {
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
            key: tab,
            element: (
                <ContentSwitcherTab
                    key={tab}
                    tab={tab}
                    hasMultipleChartTypes={this.manager.hasMultipleChartTypes}
                />
            ),
            buttonProps: {
                "data-track-note": "chart_click_" + tab,
                "aria-label": tab,
            },
        }))
    }

    @computed private get activeTab(): GrapherTabName {
        return this.manager.activeTab ?? this.availableTabs[0]
    }

    @action.bound setTab(selectedTab: GrapherTabName): void {
        const oldTab = this.manager.activeTab
        const newTab = selectedTab
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
                selectedKey={this.activeTab}
                onChange={(key) => this.setTab(key as GrapherTabName)}
            />
        )
    }
}

function ContentSwitcherTab({
    tab,
    hasMultipleChartTypes,
}: {
    tab: GrapherTabName
    hasMultipleChartTypes?: boolean
}): React.ReactElement {
    return (
        <span>
            <TabIcon tab={tab} />
            <span className="label">
                {makeTabLabelText(tab, { hasMultipleChartTypes })}
            </span>
        </span>
    )
}

function TabIcon({ tab }: { tab: GrapherTabName }): React.ReactElement {
    switch (tab) {
        case GRAPHER_TAB_NAMES.Table:
            return <FontAwesomeIcon icon={faTable} />
        case GRAPHER_TAB_NAMES.WorldMap:
            return <FontAwesomeIcon icon={faEarthAmericas} />
        default:
            return chartIcons[tab]
    }
}

function makeTabLabelText(
    tab: GrapherTabName,
    options: { hasMultipleChartTypes?: boolean }
): string {
    if (tab === GRAPHER_TAB_NAMES.Table) return "Table"
    if (tab === GRAPHER_TAB_NAMES.WorldMap) return "Map"
    if (!options.hasMultipleChartTypes) return "Chart"
    return CHART_TYPE_LABEL[tab]
}
