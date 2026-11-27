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
