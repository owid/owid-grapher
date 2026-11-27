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
    tabs: { labelMode: "label" | "icon"; paddingPx: TabPaddingPx }
    entityLabel: EntityLabelMode
    settingsLabel: "label" | "icon"
    showTableFilter: boolean
}

export type ControlsRowStep = (layout: ControlsRowLayout) => ControlsRowLayout

// Keep in sync with Controls.scss
const MENU_TOGGLE_FONT_SIZE_PX = 13
const MENU_TOGGLE_PADDING_PX = 7
const MENU_TOGGLE_BORDER_PX = 1
const MENU_TOGGLE_ICON_PX = 12
const MENU_TOGGLE_ICON_MARGIN_PX = 5
const MENU_TOGGLE_ICON_ONLY_MARGIN_PX = 2

const FULL_LAYOUT: ControlsRowLayout = {
    tabs: { labelMode: "label", paddingPx: 16 },
    entityLabel: "full",
    settingsLabel: "label",
    showTableFilter: true,
}

const COMPACTION_STEPS: readonly ControlsRowStep[] = [
    (layout) => ({ ...layout, tabs: { ...layout.tabs, paddingPx: 12 } }),
    (layout) => ({ ...layout, entityLabel: "short" }),
    (layout) => ({ ...layout, settingsLabel: "icon" }),
    (layout) => ({ ...layout, showTableFilter: false }),
    (layout) => ({ ...layout, tabs: { ...layout.tabs, labelMode: "icon" } }),
    (layout) => ({ ...layout, entityLabel: "actionOnly" }),
    (layout) => ({ ...layout, tabs: { ...layout.tabs, paddingPx: 8 } }),
]

export function findControlsRowLayout(
    measureWidth: (layout: ControlsRowLayout) => number,
    maxWidth: number
): ControlsRowLayout {
    let layout = FULL_LAYOUT
    for (const step of COMPACTION_STEPS) {
        if (measureWidth(layout) <= maxWidth) return layout
        layout = step(layout)
    }
    return layout
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
