import * as React from "react"
import { action, computed, observable } from "mobx"
import { observer } from "mobx-react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faTable, faEarthAmericas } from "@fortawesome/free-solid-svg-icons"
// import { Popover, Menu, MenuItem, Key } from "react-aria-components"
import { GrapherTabName, GRAPHER_TAB_NAMES } from "@ourworldindata/types"
import { chartIcons } from "./ChartIcons"
import { TabItem, TabKey, Tabs } from "../tabs/Tabs.js"
import { CHART_TYPE_LABEL } from "../chart/ChartTabs"

export interface ContentSwitchersManager {
    availableTabs?: GrapherTabName[]
    activeTab?: GrapherTabName
    hasMultipleChartTypes?: boolean
    setTab: (tab: GrapherTabName) => void
    onTabChange: (oldTab: GrapherTabName, newTab: GrapherTabName) => void
    isMedium?: boolean
}

const OVERFLOW_MENU_KEY = "More"
const OVERFLOW_MENU_TAB_CLASSNAME = "ContentSwitchers__OverflowMenuButton"

const MAX_VISIBLE_TABS = 4
const MAX_VISIBLE_TABS_BEFORE_OVERFLOW = 3

@observer
export class ContentSwitchers extends React.Component<{
    manager: ContentSwitchersManager
}> {
    static shouldShow(manager: ContentSwitchersManager): boolean {
        const test = new ContentSwitchers({ manager })
        return test.shouldShow
    }

    private overflowMenuTriggerRef = React.createRef<HTMLDivElement>()
    @observable private isOverflowMenuOpen = false

    @observable private hoveredTab?: GrapherTabName

    @computed private get manager(): ContentSwitchersManager {
        return this.props.manager
    }

    @computed private get hasMultipleChartTypes(): boolean {
        return !!this.manager.hasMultipleChartTypes
    }

    @computed private get availableTabs(): GrapherTabName[] {
        return this.manager.availableTabs || []
    }

    @computed private get shouldShow(): boolean {
        return this.availableTabs.length > 1
    }

    @computed private get visibleTabs(): GrapherTabName[] {
        const activeTab = this.activeTab

        // todo: drop
        return this.availableTabs

        // If there are four or fewer tabs, show all of them
        if (this.availableTabs.length <= MAX_VISIBLE_TABS) {
            return this.availableTabs
        }

        // Otherwise, only show the first 3 tabs
        const visibleTabs = this.availableTabs.slice(
            0,
            MAX_VISIBLE_TABS_BEFORE_OVERFLOW
        )

        // If the active tab is not visible, replace the last visible tab with it
        if (!visibleTabs.includes(activeTab)) {
            visibleTabs[visibleTabs.length - 1] = activeTab
        }

        return visibleTabs
    }

    @computed private get hiddenTabs(): GrapherTabName[] {
        return this.availableTabs.filter(
            (tab) => !this.visibleTabs.includes(tab)
        )
    }

    @computed private get activeTab(): GrapherTabName {
        return this.manager.activeTab ?? this.availableTabs[0]
    }

    @computed private get tabItems(): TabItem[] {
        const { hasMultipleChartTypes } = this

        const visibleTabItems: TabItem[] = this.visibleTabs.map((tab) => ({
            key: tab,
            element: (
                <TabContent
                    key={tab}
                    tab={tab}
                    hasMultipleChartTypes={hasMultipleChartTypes}
                />
            ),
            props: {
                "data-track-note": "chart_click_" + tab,
                "aria-label": getTabDisplayText(tab, { hasMultipleChartTypes }),
            },
        }))

        // Add overflow menu button if there are hidden tabs
        if (this.hiddenTabs.length > 0) {
            visibleTabItems.push({
                key: OVERFLOW_MENU_KEY,
                element: <>+&#8202;{this.hiddenTabs.length}</>,
                props: {
                    // the popover is positioned relative to this tab
                    // ref: this.overflowMenuTriggerRef,
                    className: OVERFLOW_MENU_TAB_CLASSNAME,
                    "aria-label": "Show more chart types",
                },
            })
        }

        return visibleTabItems
    }

    @action.bound private setTab(selectedTab: GrapherTabName): void {
        const previousTab = this.manager.activeTab
        const newTab = selectedTab
        this.manager.setTab(newTab)
        this.manager.onTabChange?.(previousTab!, newTab)
    }

    @action.bound private showOverflowMenu(): void {
        this.isOverflowMenuOpen = true
    }

    @action.bound private hideOverflowMenu(): void {
        this.isOverflowMenuOpen = false
    }

    @action.bound private onOverflowMenuOpenChange(isOpen: boolean): void {
        this.isOverflowMenuOpen = isOpen

        // If the menu is closed and the user was hovering a tab, select that tab
        // (Otherwise you'd need to press twice, once to close the popup, and
        // again to select the tab)
        if (!isOpen && this.hoveredTab) {
            this.setTab(this.hoveredTab)
        }
    }

    @action.bound private shouldOverflowMenuCloseOnInteractOutside(
        element: Element
    ): boolean {
        // When the '+X' overflow menu button is clicked, it triggers both the tab selection
        // and the popover's onOpenChange event, causing the menu to open and immediately close.
        // To prevent this, we don't close the menu when clicking specifically on the overflow button.
        const overflowMenuTabSelector = `.${OVERFLOW_MENU_TAB_CLASSNAME}`
        const isOverflowMenuTabClicked =
            element.closest(overflowMenuTabSelector) !== null
        return !isOverflowMenuTabClicked
    }

    @action.bound private onTabHover(tabKey: string | undefined): void {
        this.hoveredTab = tabKey as GrapherTabName | undefined
    }

    @action.bound private onTabChange(selectedKey: TabKey): void {
        if (selectedKey === OVERFLOW_MENU_KEY) {
            this.showOverflowMenu()
        } else {
            this.setTab(selectedKey as GrapherTabName)
        }
    }

    // @action.bound private onOverflowMenuItemSelect(tab: Key): void {
    //     this.setTab(tab as GrapherTabName)
    //     this.hideOverflowMenu()
    // }

    render(): React.ReactElement | null {
        const { hasMultipleChartTypes, shouldShow } = this

        if (!shouldShow) return null

        return (
            <>
                <Tabs
                    variant="slim"
                    className="ContentSwitchers"
                    items={this.tabItems}
                    selectedKey={
                        this.isOverflowMenuOpen
                            ? OVERFLOW_MENU_KEY
                            : this.activeTab
                    }
                    onChange={this.onTabChange}
                    onHoverStart={(event) =>
                        this.onTabHover(event.target.dataset.key)
                    }
                    onHoverEnd={() => this.onTabHover(undefined)}
                />

                {/* <Popover
                    className="ContentSwitchers__OverflowMenu"
                    triggerRef={this.overflowMenuTriggerRef}
                    isOpen={this.isOverflowMenuOpen}
                    onOpenChange={this.onOverflowMenuOpenChange}
                    shouldCloseOnInteractOutside={
                        this.shouldOverflowMenuCloseOnInteractOutside
                    }
                >
                    <Menu onAction={this.onOverflowMenuItemSelect}>
                        {this.hiddenTabs.map((tab) => (
                            <MenuItem
                                key={tab}
                                id={tab}
                                className="ContentSwitchers__OverflowMenuItem"
                            >
                                <TabContent
                                    tab={tab}
                                    hasMultipleChartTypes={
                                        hasMultipleChartTypes
                                    }
                                />
                            </MenuItem>
                        ))}
                    </Menu>
                </Popover> */}
            </>
        )
    }
}

function TabContent({
    tab,
    hasMultipleChartTypes,
}: {
    tab: GrapherTabName
    hasMultipleChartTypes?: boolean
}): React.ReactElement {
    return (
        <>
            <TabIcon tab={tab} />
            <span className="label">
                {getTabDisplayText(tab, { hasMultipleChartTypes })}
            </span>
        </>
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

function getTabDisplayText(
    tab: GrapherTabName,
    options: { hasMultipleChartTypes?: boolean }
): string {
    if (tab === GRAPHER_TAB_NAMES.Table) return "Table"
    if (tab === GRAPHER_TAB_NAMES.WorldMap) return "Map"
    if (!options.hasMultipleChartTypes) return "Chart"
    return CHART_TYPE_LABEL[tab]
}
