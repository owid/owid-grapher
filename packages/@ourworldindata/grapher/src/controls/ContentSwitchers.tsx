import * as React from "react"
import { action, computed, observable, makeObservable } from "mobx"
import cx from "classnames"
import { observer } from "mobx-react"
import { GrapherTabName } from "@ourworldindata/types"
import { TabItem, Tabs } from "../tabs/Tabs.js"
import { makeLabelForGrapherTab } from "../chart/ChartTabs"
import {
    Button,
    Menu,
    MenuItem,
    MenuTrigger,
    Popover,
} from "react-aria-components"
import { GrapherTabIcon } from "@ourworldindata/components"

export interface ContentSwitchersManager {
    availableTabs?: GrapherTabName[]
    activeTab?: GrapherTabName
    hasMultipleChartTypes?: boolean
    setTab: (tab: GrapherTabName) => void
    onTabChange: (oldTab: GrapherTabName, newTab: GrapherTabName) => void
    isMedium?: boolean
}

const MAX_VISIBLE_TABS = 4
const MAX_VISIBLE_TABS_BEFORE_OVERFLOW = 3

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

    @computed private get tabItems(): TabItem<GrapherTabName>[] {
        const { hasMultipleChartTypes } = this

        return this.visibleTabs.map((tab) => ({
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
                dataTrackNote: "chart_click_" + tab,
                ariaLabel: makeLabelForGrapherTab(tab, {
                    useGenericChartLabel: !hasMultipleChartTypes,
                }),
            },
        }))
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

    @action.bound private onTabChange(selectedKey: GrapherTabName): void {
        this.setTab(selectedKey)
    }

    @action.bound private onOverflowMenuSelect(tab: GrapherTabName): void {
        this.setTab(tab)
    }

    private renderOverflowMenu(): React.ReactElement {
        const { hasMultipleChartTypes } = this

        return (
            <MenuTrigger
                isOpen={this.isOverflowMenuOpen}
                onOpenChange={(isOpen) => {
                    if (isOpen) this.showOverflowMenu()
                    else this.hideOverflowMenu()
                }}
            >
                <Button
                    className={cx(
                        "Tabs__Tab ContentSwitchers__OverflowMenuButton",
                        { "is-open": this.isOverflowMenuOpen }
                    )}
                    aria-label="Show more chart types"
                >
                    +&#8202;{this.hiddenTabs.length}
                </Button>
                <Popover
                    className="ContentSwitchers__OverflowMenu"
                    placement="bottom"
                >
                    <Menu
                        className="ContentSwitchers__OverflowMenuList"
                        onAction={(key) =>
                            this.onOverflowMenuSelect(key as GrapherTabName)
                        }
                    >
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
                </Popover>
            </MenuTrigger>
        )
    }

    override render(): React.ReactElement | null {
        if (!this.shouldShow) return null

        return (
            <div className="ContentSwitchers__Container">
                <Tabs
                    variant="slim"
                    className="ContentSwitchers"
                    items={this.tabItems}
                    selectedKey={this.activeTab}
                    onChange={this.onTabChange}
                />
                {this.hiddenTabs.length > 0 && this.renderOverflowMenu()}
            </div>
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
