import * as React from "react"
import { useCallback } from "react"
import { action, computed, makeObservable, observable } from "mobx"
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

export interface ContentSwitchersManager {
    availableTabs?: GrapherTabName[]
    activeTab?: GrapherTabName
    setTab: (tab: GrapherTabName) => void
    onTabChange: (oldTab: GrapherTabName, newTab: GrapherTabName) => void
    isMedium?: boolean
}

function shouldShowContentSwitchers(manager: ContentSwitchersManager): boolean {
    return (manager.availableTabs ?? []).length > 1
}

@observer
export class ContentSwitchers extends React.Component<{
    manager: ContentSwitchersManager
}> {
    private readonly wrapper = React.createRef<HTMLDivElement>()
    private readonly measurement = React.createRef<HTMLDivElement>()
    private resizeObserver?: ResizeObserver
    private availableWidth = 0
    private tabWidths: number[] = []
    private overflowWidth = 0

    constructor(props: { manager: ContentSwitchersManager }) {
        super(props)
        makeObservable<this, "availableWidth" | "tabWidths" | "overflowWidth">(
            this,
            {
                availableWidth: observable,
                tabWidths: observable.ref,
                overflowWidth: observable,
            }
        )
    }

    override componentDidMount(): void {
        this.resizeObserver = new ResizeObserver(this.measure)
        this.observeSizes()
    }

    override componentDidUpdate(): void {
        this.observeSizes()
    }

    override componentWillUnmount(): void {
        this.resizeObserver?.disconnect()
    }

    private observeSizes(): void {
        this.resizeObserver?.disconnect()
        if (this.wrapper.current)
            this.resizeObserver?.observe(this.wrapper.current)
        for (const element of this.measurement.current?.children ?? []) {
            this.resizeObserver?.observe(element)
        }
        this.measure()
    }

    @action.bound private measure(): void {
        if (!this.wrapper.current || !this.measurement.current) return
        this.availableWidth = this.wrapper.current.getBoundingClientRect().width
        const widths = Array.from(
            this.measurement.current.children,
            (element) => element.getBoundingClientRect().width
        )
        this.overflowWidth = widths.pop() ?? 0
        if (
            widths.length !== this.tabWidths.length ||
            widths.some((width, index) => width !== this.tabWidths[index])
        ) {
            this.tabWidths = widths
        }
    }

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

        // Preserve the existing layout until the browser can measure the tabs.
        if (this.tabWidths.length !== availableTabs.length) {
            const visibleTabs = availableTabs.slice(
                0,
                availableTabs.length <= 4 ? 4 : 3
            )
            if (!visibleTabs.includes(activeTab))
                visibleTabs[visibleTabs.length - 1] = activeTab
            return visibleTabs
        }

        // The slim tab list has 2px of padding on each side.
        const availableWidth = this.availableWidth - 4
        if (
            this.tabWidths.reduce((sum, width) => sum + width, 0) <=
            availableWidth
        )
            return availableTabs

        for (let count = availableTabs.length - 1; count > 0; count--) {
            const visibleTabs = availableTabs.slice(0, count)
            // Keep the active tab visible, including its width in the fit check.
            if (!visibleTabs.includes(activeTab))
                visibleTabs[count - 1] = activeTab
            const width = visibleTabs.reduce(
                (sum, tab) =>
                    sum +
                    (this.tabWidths[availableTabs.indexOf(tab)] ?? Infinity),
                this.overflowWidth
            )
            if (width <= availableWidth || count === 1) return visibleTabs
        }
        return availableTabs
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
            <div className="ContentSwitchers__Wrapper" ref={this.wrapper}>
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
                <div
                    className="ContentSwitchers__Container ContentSwitchers__Measurement"
                    aria-hidden="true"
                    ref={this.measurement}
                >
                    {this.availableTabs.map((tab) => (
                        <span key={tab} data-tab={tab} className="Tabs__Tab">
                            <TabContent tab={tab} />
                        </span>
                    ))}
                    <span className="Tabs__Tab ContentSwitchers__OverflowMenuButton">
                        <span className="label">
                            +&#8202;{this.hiddenTabs.length}
                        </span>
                    </span>
                </div>
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
