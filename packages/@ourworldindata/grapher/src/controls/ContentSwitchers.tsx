import * as React from "react"
import { action, computed, observable, makeObservable } from "mobx"
import cx from "classnames"
import { observer } from "mobx-react"
import { GrapherTabName } from "@ourworldindata/types"
import { TabItem, Tabs } from "../tabs/Tabs.js"
import { makeLabelForGrapherTab } from "../chart/ChartTabs"
import { Popover } from "../popover/Popover"
import { CONTROLS_ROW_HEIGHT } from "../captionedChart/CaptionedChart"
import { GrapherTabIcon } from "@ourworldindata/components"

export interface ContentSwitchersManager {
    availableTabs?: GrapherTabName[]
    activeTab?: GrapherTabName
    hasMultipleChartTypes?: boolean
    setTab: (tab: GrapherTabName) => void
    onTabChange: (oldTab: GrapherTabName, newTab: GrapherTabName) => void
    isMedium?: boolean
}

const OVERFLOW_MENU_KEY = "More"

const MAX_VISIBLE_TABS = 4
const MAX_VISIBLE_TABS_BEFORE_OVERFLOW = 3

type TabKey = GrapherTabName | typeof OVERFLOW_MENU_KEY

@observer
export class ContentSwitchers extends React.Component<{
    manager: ContentSwitchersManager
}> {
    constructor(props: { manager: ContentSwitchersManager }) {
        super(props)

        makeObservable<ContentSwitchers, "isOverflowMenuOpen">(this, {
            isOverflowMenuOpen: observable,
        })
    }

    static shouldShow(manager: ContentSwitchersManager): boolean {
        const test = new ContentSwitchers({ manager })
        return test.shouldShow
    }

    private isOverflowMenuOpen = false

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
        const { activeTab, availableTabs } = this

        // If there are four or fewer tabs, show all of them
        if (availableTabs.length <= MAX_VISIBLE_TABS) {
            return availableTabs
        }

        // Otherwise, only show the first 3 tabs
        const visibleTabs = availableTabs.slice(
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

    @computed private get selectedTabKey(): TabKey {
        return this.isOverflowMenuOpen ? OVERFLOW_MENU_KEY : this.activeTab
    }

    @computed private get tabItems(): TabItem<TabKey>[] {
        const { hasMultipleChartTypes } = this

        const visibleTabItems: TabItem<TabKey>[] = this.visibleTabs.map(
            (tab) => ({
                key: tab,
                element: (
                    <TabContent
                        key={tab}
                        tab={tab}
                        hasMultipleChartTypes={hasMultipleChartTypes}
                    />
                ),
                buttonProps: {
                    className: cx({ active: tab === this.activeTab }),
                    "data-track-note": "chart_click_" + tab,
                    "aria-label": makeLabelForGrapherTab(tab, {
                        useGenericChartLabel: !hasMultipleChartTypes,
                    }),
                },
            })
        )

        // Add overflow menu button if there are hidden tabs
        if (this.hiddenTabs.length > 0) {
            visibleTabItems.push({
                key: OVERFLOW_MENU_KEY,
                element: <>+&#8202;{this.hiddenTabs.length}</>,
                buttonProps: {
                    className: "ContentSwitchers__OverflowMenuButton",
                    "aria-label": "Show more chart types",
                },
            })
        }

        return visibleTabItems
    }

    @action.bound private setTab(selectedTab: GrapherTabName): void {
        const oldTab = this.manager.activeTab
        const newTab = selectedTab
        this.manager.setTab(newTab)
        this.manager.onTabChange?.(oldTab!, newTab)
    }

    @action.bound private showOverflowMenu(): void {
        this.isOverflowMenuOpen = true
    }

    @action.bound private hideOverflowMenu(): void {
        this.isOverflowMenuOpen = false
    }

    @action.bound private onTabChange(selectedKey: TabKey): void {
        if (selectedKey === OVERFLOW_MENU_KEY) {
            this.showOverflowMenu()
        } else {
            this.setTab(selectedKey as GrapherTabName)
            this.hideOverflowMenu()
        }
    }

    @action.bound private onOverflowMenuSelect(tab: GrapherTabName): void {
        this.setTab(tab)
        this.hideOverflowMenu()
    }

    private renderOverflowMenu(): React.ReactElement {
        const { hasMultipleChartTypes } = this

        const style = {
            top: CONTROLS_ROW_HEIGHT + 4, // small margin between the tabs and popover
            right: 14, // roughly the half width of the +X button
            transform: `translateX(50%)`,
        }

        return (
            <Popover
                className="ContentSwitchers__OverflowMenu"
                isOpen={this.isOverflowMenuOpen}
                onClose={this.hideOverflowMenu}
                style={style}
            >
                {this.hiddenTabs.map((tab) => (
                    <button
                        key={tab}
                        type="button"
                        className="ContentSwitchers__OverflowMenuItem"
                        onClick={() => this.onOverflowMenuSelect(tab)}
                    >
                        <TabContent
                            tab={tab}
                            hasMultipleChartTypes={hasMultipleChartTypes}
                        />
                    </button>
                ))}
            </Popover>
        )
    }

    override render(): React.ReactElement | null {
        if (!this.shouldShow) return null

        return (
            <Tabs
                variant="slim"
                className="ContentSwitchers"
                items={this.tabItems}
                selectedKey={this.selectedTabKey}
                onChange={this.onTabChange}
                slot={this.renderOverflowMenu()}
            />
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
        <span>
            <GrapherTabIcon tab={tab} />
            <span className="label">
                {makeLabelForGrapherTab(tab, {
                    useGenericChartLabel: !hasMultipleChartTypes,
                })}
            </span>
        </span>
    )
}
