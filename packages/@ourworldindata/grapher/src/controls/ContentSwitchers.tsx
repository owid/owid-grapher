import * as React from "react"
import { action, computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faTable, faEarthAmericas } from "@fortawesome/free-solid-svg-icons"
import { GrapherTabName, GRAPHER_TAB_NAMES } from "@ourworldindata/types"
import { chartIcons } from "./ChartIcons"
import { TabItem, Tabs } from "../tabs/Tabs.js"
import { CHART_TYPE_LABEL } from "../chart/ChartTabs"

export interface ContentSwitchersManager {
    availableTabs?: GrapherTabName[]
    activeTab?: GrapherTabName
    hasMultipleChartTypes?: boolean
    setTab: (tab: GrapherTabName) => void
    onTabChange: (oldTab: GrapherTabName, newTab: GrapherTabName) => void
    isMedium?: boolean
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

    @computed private get tabItems(): TabItem<GrapherTabName>[] {
        const { hasMultipleChartTypes } = this.manager
        return this.availableTabs.map((tab) => ({
            key: tab,
            element: (
                <ContentSwitcherTab
                    key={tab}
                    tab={tab}
                    hasMultipleChartTypes={hasMultipleChartTypes}
                />
            ),
            buttonProps: {
                "data-track-note": "chart_click_" + tab,
                "aria-label": makeTabLabelText(tab, { hasMultipleChartTypes }),
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
                className="ContentSwitchers"
                items={this.tabItems}
                selectedKey={this.activeTab}
                onChange={this.setTab}
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
