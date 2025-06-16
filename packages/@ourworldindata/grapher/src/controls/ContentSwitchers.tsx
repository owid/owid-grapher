import * as React from "react"
import { action, computed } from "mobx"
import { observer } from "mobx-react"
import classnames from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import {
    faTable,
    faEarthAmericas,
    faPlus,
} from "@fortawesome/free-solid-svg-icons"
import {
    MenuTrigger,
    Button,
    Popover,
    Menu,
    MenuItem,
} from "react-aria-components"
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

const MAX_VISIBLE_TABS = 3

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

    @computed private get hasOverflow(): boolean {
        return this.availableTabs.length > MAX_VISIBLE_TABS
    }

    @computed private get visibleTabs(): GrapherTabName[] {
        if (!this.hasOverflow) return this.availableTabs

        const activeTab = this.activeTab
        const firstThree = this.availableTabs.slice(0, MAX_VISIBLE_TABS)

        // If the active tab is not in the first three, replace the last visible tab with the active tab
        if (!firstThree.includes(activeTab)) {
            return [...firstThree.slice(0, MAX_VISIBLE_TABS - 1), activeTab]
        }

        return firstThree
    }

    @computed private get overflowTabs(): GrapherTabName[] {
        if (!this.hasOverflow) return []

        const visibleTabs = this.visibleTabs
        return this.availableTabs.filter((tab) => !visibleTabs.includes(tab))
    }

    @computed private get tabLabels(): TabLabel[] {
        return this.visibleTabs.map((tab) => ({
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

    @action.bound onOverflowMenuAction(key: React.Key): void {
        this.setTab(key as GrapherTabName)
    }

    private renderOverflowMenu(): React.ReactElement {
        return (
            <MenuTrigger>
                <Button
                    className="Tabs__tab ContentSwitchers__overflow-button"
                    data-track-note="chart_content_switchers_overflow"
                    aria-label="More chart types"
                >
                    <FontAwesomeIcon icon={faPlus} />
                    {this.showTabLabels && <span className="label">More</span>}
                </Button>
                <Popover className="ContentSwitchers__overflow-menu">
                    <Menu
                        className="ContentSwitchers__menu"
                        onAction={this.onOverflowMenuAction}
                    >
                        {this.overflowTabs.map((tab) => (
                            <MenuItem
                                key={tab}
                                id={tab}
                                className="ContentSwitchers__menu-item"
                                textValue={makeTabLabelText(tab, {
                                    hasMultipleChartTypes:
                                        this.manager.hasMultipleChartTypes,
                                })}
                            >
                                <ContentSwitcherTab
                                    tab={tab}
                                    hasMultipleChartTypes={
                                        this.manager.hasMultipleChartTypes
                                    }
                                    showLabel={this.showTabLabels}
                                />
                            </MenuItem>
                        ))}
                    </Menu>
                </Popover>
            </MenuTrigger>
        )
    }

    render(): React.ReactElement | null {
        if (!this.shouldShow) return null

        if (!this.hasOverflow) {
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

        return (
            <div
                className={classnames("ContentSwitchers__wrapper", {
                    iconOnly: !this.showTabLabels,
                })}
            >
                <Tabs
                    variant="slim"
                    extraClassNames="ContentSwitchers"
                    labels={this.tabLabels}
                    selectedKey={this.activeTab}
                    onChange={(key) => this.setTab(key as GrapherTabName)}
                />
                {this.renderOverflowMenu()}
            </div>
        )
    }
}

function ContentSwitcherTab({
    tab,
    hasMultipleChartTypes,
    showLabel = true,
}: {
    tab: GrapherTabName
    hasMultipleChartTypes?: boolean
    showLabel?: boolean
}): React.ReactElement {
    return (
        <span>
            <TabIcon tab={tab} />
            {showLabel && (
                <span className="label">
                    {makeTabLabelText(tab, { hasMultipleChartTypes })}
                </span>
            )}
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
