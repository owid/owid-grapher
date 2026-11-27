import * as React from "react"
import { useCallback } from "react"
import { action, computed } from "mobx"
import cx from "clsx"
import { observer } from "mobx-react"
import { GrapherTabName } from "@ourworldindata/types"
import { TabItem, Tabs } from "../tabs/Tabs.js"
import { makeLabelForGrapherTab } from "../chart/ChartTabs"
import {
    Key,
    Button,
    Menu,
    MenuItem,
    MenuTrigger,
    Popover,
} from "react-aria-components"
import { GrapherTabIcon } from "@ourworldindata/components"
import { Bounds } from "@ourworldindata/utils"
import {
    ControlsRowLayout,
    pickVisibleTabs,
    TabPartition,
} from "./controlsRow/ControlsRowHelpers"

export interface ContentSwitchersManager {
    availableTabs?: GrapherTabName[]
    activeTab?: GrapherTabName
    setTab: (tab: GrapherTabName) => void
    onTabChange: (oldTab: GrapherTabName, newTab: GrapherTabName) => void
}

// Keep in sync with Tabs.scss and ContentSwitchers.scss
const TAB_FONT_SIZE_PX = 13
const TAB_LIST_PADDING_PX = 2
const TAB_ICON_PX = 13
const TAB_ICON_GAP_PX = 6
const OVERFLOW_BUTTON_PADDING_PX = 8

const BOLD_IN_PLACE_OF_MEDIUM = 700
const OVERFLOW_LABEL_HAIR_SPACE_PX = 1

function shouldShowContentSwitchers(manager: ContentSwitchersManager): boolean {
    return (manager.availableTabs ?? []).length > 1
}

interface ContentSwitchersProps {
    manager: ContentSwitchersManager
    layout: ControlsRowLayout["tabs"]
    visibleTabCount: number
}

@observer
export class ContentSwitchers extends React.Component<ContentSwitchersProps> {
    static shouldShow(manager: ContentSwitchersManager): boolean {
        return shouldShowContentSwitchers(manager)
    }

    static measureWidth(
        manager: ContentSwitchersManager,
        tabsLayout: ControlsRowLayout["tabs"],
        visibleTabCount: number
    ): number {
        const switchers = new ContentSwitchers({
            manager,
            layout: tabsLayout,
            visibleTabCount,
        })
        if (!switchers.shouldShow) return 0
        const { visible, hidden } = switchers.tabPartition
        return measureTabGroupWidth(
            visible.map((tab) => makeLabelForGrapherTab(tab)),
            hidden.length,
            tabsLayout
        )
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

    @computed private get tabPartition(): TabPartition {
        return pickVisibleTabs(
            this.availableTabs,
            this.activeTab,
            this.props.visibleTabCount
        )
    }

    @computed private get activeTab(): GrapherTabName {
        return this.manager.activeTab ?? this.availableTabs[0]
    }

    @computed private get tabItems(): TabItem<GrapherTabName>[] {
        return this.tabPartition.visible.map((tab) => ({
            key: tab,
            element: (
                <TabContent
                    key={tab}
                    tab={tab}
                    showLabel={this.props.layout.labelMode === "label"}
                />
            ),
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

        const { labelMode, paddingPx } = this.props.layout
        const { hidden } = this.tabPartition
        return (
            <div className="ContentSwitchers__Container">
                <Tabs
                    variant="slim"
                    className={cx("ContentSwitchers", {
                        "ContentSwitchers--tab-padding-12": paddingPx === 12,
                        "ContentSwitchers--tab-padding-8": paddingPx === 8,
                        "ContentSwitchers--icon-only": labelMode === "icon",
                    })}
                    items={this.tabItems}
                    selectedKey={this.activeTab}
                    onChange={this.setTab}
                />
                {hidden.length > 0 && (
                    <OverflowMenu hiddenTabs={hidden} onSelect={this.setTab} />
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

function TabContent({
    tab,
    showLabel = true,
}: {
    tab: GrapherTabName
    showLabel?: boolean
}): React.ReactElement {
    return (
        <span className="ContentSwitchers__TabContent">
            <GrapherTabIcon tab={tab} />
            {showLabel && (
                <span className="label">{makeLabelForGrapherTab(tab)}</span>
            )}
        </span>
    )
}

function measureTabGroupWidth(
    visibleTabLabels: string[],
    hiddenTabCount: number,
    tabsLayout: ControlsRowLayout["tabs"]
): number {
    const tabsWidth =
        2 * TAB_LIST_PADDING_PX +
        sumWidths(
            visibleTabLabels.map((label) => measureTabWidth(label, tabsLayout))
        )
    if (hiddenTabCount === 0) return tabsWidth
    return tabsWidth + measureOverflowButtonWidth(hiddenTabCount)
}

function measureTabWidth(
    label: string,
    { labelMode, paddingPx }: ControlsRowLayout["tabs"]
): number {
    if (labelMode === "icon") return 2 * paddingPx + TAB_ICON_PX
    return (
        2 * paddingPx +
        TAB_ICON_PX +
        TAB_ICON_GAP_PX +
        measureTabTextWidth(label)
    )
}

function measureOverflowButtonWidth(hiddenTabCount: number): number {
    return (
        2 * OVERFLOW_BUTTON_PADDING_PX +
        measureTabTextWidth(`+${hiddenTabCount}`) +
        OVERFLOW_LABEL_HAIR_SPACE_PX
    )
}

function measureTabTextWidth(text: string): number {
    return Bounds.forText(text, {
        fontSize: TAB_FONT_SIZE_PX,
        fontWeight: BOLD_IN_PLACE_OF_MEDIUM,
    }).width
}

function sumWidths(widths: number[]): number {
    return widths.reduce((total, width) => total + width, 0)
}
