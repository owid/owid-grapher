import { GrapherTabName } from "@ourworldindata/types"
import { Bounds } from "@ourworldindata/utils"

export type TabPaddingPx = 16 | 12 | 8

export type EntityLabelMode =
    | "full" // "Edit countries and regions"
    | "short" // "Edit countries", or "Edit" for a label without a suffix
    | "actionOnly" // "Edit"

export interface EntityLabelParts {
    action: string
    entity: string
    entitySuffix?: string
}

export interface ControlsRowLayout {
    tabs: {
        labelMode: "label" | "icon"
        paddingPx: TabPaddingPx
        visibleTabCount: number
    }
    entityLabel: EntityLabelMode
    settingsLabel: "label" | "icon"
    showTableFilter: boolean
}

export interface TabPartition {
    visible: GrapherTabName[]
    hidden: GrapherTabName[]
}

export type ControlsRowStep = (layout: ControlsRowLayout) => ControlsRowLayout

// Keep in sync with Controls.scss
const MENU_TOGGLE_FONT_SIZE_PX = 13
const MENU_TOGGLE_PADDING_PX = 7
const MENU_TOGGLE_BORDER_PX = 1
const MENU_TOGGLE_ICON_PX = 12
const MENU_TOGGLE_ICON_MARGIN_PX = 5
const MENU_TOGGLE_ICON_ONLY_MARGIN_PX = 2

export function findControlsRowLayout(
    measureWidth: (layout: ControlsRowLayout) => number,
    maxWidth: number,
    tabCount: number
): ControlsRowLayout {
    let layout = makeFullLayout(tabCount)
    for (const step of listCompactionSteps(tabCount)) {
        if (measureWidth(layout) <= maxWidth) return layout
        layout = step(layout)
    }
    return layout
}

export function pickVisibleTabs(
    tabs: GrapherTabName[],
    activeTab: GrapherTabName,
    count: number
): TabPartition {
    if (count >= tabs.length) return { visible: tabs, hidden: [] }

    const visible = tabs.slice(0, count)
    if (!visible.includes(activeTab)) visible[count - 1] = activeTab

    const hidden = tabs.filter((tab) => !visible.includes(tab))
    return { visible, hidden }
}

export function measureMenuToggleWidth(
    label: string,
    iconPx: number = MENU_TOGGLE_ICON_PX
): number {
    return (
        2 * (MENU_TOGGLE_PADDING_PX + MENU_TOGGLE_BORDER_PX) +
        iconPx +
        MENU_TOGGLE_ICON_MARGIN_PX +
        Bounds.forText(label, { fontSize: MENU_TOGGLE_FONT_SIZE_PX }).width
    )
}

export function measureIconOnlyMenuToggleWidth(): number {
    return (
        2 * (MENU_TOGGLE_PADDING_PX + MENU_TOGGLE_BORDER_PX) +
        MENU_TOGGLE_ICON_PX +
        2 * MENU_TOGGLE_ICON_ONLY_MARGIN_PX
    )
}

export function resolveEntityLabel(
    mode: EntityLabelMode,
    { action, entity, entitySuffix }: EntityLabelParts
): string {
    switch (mode) {
        case "full":
            return `${action} ${entity}${entitySuffix ?? ""}`
        case "short":
            return entitySuffix ? `${action} ${entity}` : action
        case "actionOnly":
            return action
    }
}

function makeFullLayout(tabCount: number): ControlsRowLayout {
    return {
        tabs: { labelMode: "label", paddingPx: 16, visibleTabCount: tabCount },
        entityLabel: "full",
        settingsLabel: "label",
        showTableFilter: true,
    }
}

function listCompactionSteps(tabCount: number): ControlsRowStep[] {
    return [
        setTabPadding(12),
        setEntityLabel("short"),
        showSettingsAsIcon,
        hideTableFilter,
        ...hideTabsOneByOne({ from: tabCount, downTo: 2 }),
        switchTabsToIcons(tabCount),
        ...hideTabsOneByOne({ from: tabCount, downTo: 1 }),
        setEntityLabel("actionOnly"),
        setTabPadding(8),
    ]
}

function setTabPadding(paddingPx: TabPaddingPx): ControlsRowStep {
    return (layout) => withTabs(layout, { paddingPx })
}

function setEntityLabel(entityLabel: EntityLabelMode): ControlsRowStep {
    return (layout) => ({ ...layout, entityLabel })
}

function showSettingsAsIcon(layout: ControlsRowLayout): ControlsRowLayout {
    return { ...layout, settingsLabel: "icon" }
}

function hideTableFilter(layout: ControlsRowLayout): ControlsRowLayout {
    return { ...layout, showTableFilter: false }
}

function hideTabsOneByOne({
    from,
    downTo,
}: {
    from: number
    downTo: number
}): ControlsRowStep[] {
    return Array.from({ length: Math.max(0, from - downTo) }, () => hideOneTab)
}

function hideOneTab(layout: ControlsRowLayout): ControlsRowLayout {
    return withTabs(layout, {
        visibleTabCount: layout.tabs.visibleTabCount - 1,
    })
}

function switchTabsToIcons(tabCount: number): ControlsRowStep {
    return (layout) =>
        withTabs(layout, { labelMode: "icon", visibleTabCount: tabCount })
}

function withTabs(
    layout: ControlsRowLayout,
    tabs: Partial<ControlsRowLayout["tabs"]>
): ControlsRowLayout {
    return { ...layout, tabs: { ...layout.tabs, ...tabs } }
}
