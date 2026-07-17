import * as React from "react"
import { useCallback } from "react"
import { action, computed } from "mobx"
import cx from "clsx"
import { observer } from "mobx-react"
import { GrapherTabName } from "@ourworldindata/types"
import { TabItem, Tabs } from "../tabs/Tabs.js"
import { makeLabelForGrapherTab } from "../chart/ChartTabs"
import {
    type Key,
    Menu,
    MenuItem,
    MenuTrigger,
    Popover,
} from "react-aria-components/Menu"
import { Button } from "react-aria-components/Button"
import { GrapherTabIcon } from "@ourworldindata/components"

export interface ContentSwitchersManager {
    availableTabs?: GrapherTabName[]
    activeTab?: GrapherTabName
    setTab: (tab: GrapherTabName) => void
    onTabChange: (oldTab: GrapherTabName, newTab: GrapherTabName) => void
    isMedium?: boolean
}

const MAX_VISIBLE_TABS = 4
const MAX_VISIBLE_TABS_BEFORE_OVERFLOW = 3

function shouldShowContentSwitchers(manager: ContentSwitchersManager): boolean {
    return (manager.availableTabs ?? []).length > 1
}

@observer
export class ContentSwitchers extends React.Component<{
    manager: ContentSwitchersManager
}> {
    static shouldShow(manager: ContentSwitchersManager): boolean {
        return shouldShowContentSwitchers(manager)
    }

    @computed private get manager(): ContentSwitchersManager {
        return this.props.manager
    }

    @computed private get availableTabs(): GrapherTabName[] {
        return this.manager.availableTabs || []
    }

    @computed private get shouldShow(): boolean {
        return shouldShowContentSwitchers(this.manager)
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
        return this.visibleTabs.map((tab) => ({
            key: tab,
            element: <TabContent key={tab} tab={tab} />,
            buttonProps: {
                className: cx({ active: tab === this.activeTab }),
                dataTrackNote: "chart_click_" + tab,
                ariaLabel: makeLabelForGrapherTab(tab),
            },
        }))
    }

    @action.bound private setTab(selectedTab: GrapherTabName): void {
        const oldTab = this.manager.activeTab
        const newTab = selectedTab
        this.manager.setTab(newTab)
        this.manager.onTabChange?.(oldTab!, newTab)
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
                    onChange={this.setTab}
                />
                {this.hiddenTabs.length > 0 && (
                    <OverflowMenu
                        hiddenTabs={this.hiddenTabs}
                        onSelect={this.setTab}
                    />
                )}
            </div>
        )
    }
}

function OverflowMenu({
    hiddenTabs,
    onSelect,
}: {
    hiddenTabs: GrapherTabName[]
    onSelect: (tab: GrapherTabName) => void
}): React.ReactElement {
    const handleAction = useCallback(
        (key: Key) => {
            onSelect(key as GrapherTabName)
        },
        [onSelect]
    )

    return (
        <MenuTrigger>
            <Button
                className="Tabs__Tab ContentSwitchers__OverflowMenuButton"
                aria-label="Show more chart types"
            >
                <span className="label">+&#8202;{hiddenTabs.length}</span>
            </Button>
            <Popover
                className="ContentSwitchers__OverflowMenu"
                placement="bottom"
            >
                <Menu
                    className="ContentSwitchers__OverflowMenuList"
                    onAction={handleAction}
                >
                    {hiddenTabs.map((tab) => (
                        <MenuItem
                            key={tab}
                            id={tab}
                            className="ContentSwitchers__OverflowMenuItem"
                        >
                            <TabContent tab={tab} />
                        </MenuItem>
                    ))}
                </Menu>
            </Popover>
        </MenuTrigger>
    )
}

function TabContent({ tab }: { tab: GrapherTabName }): React.ReactElement {
    return (
        <span className="ContentSwitchers__TabContent">
            <GrapherTabIcon tab={tab} />
            <span className="label">{makeLabelForGrapherTab(tab)}</span>
        </span>
    )
}
