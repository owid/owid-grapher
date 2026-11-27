import { ControlsRowLayout, findControlsRowLayout } from "./ControlsRowHelpers"

export interface CompactionStep {
    changedFields: string
    before: ControlsRowLayout
    after: ControlsRowLayout
}

export function listCompactionSteps(tabCount: number): CompactionStep[] {
    const layouts = listLayoutsInStepOrder(tabCount)
    return layouts.slice(1).map((after, i) => {
        const before = layouts[i]
        const changes = Object.entries(flattenLayout(after))
            .filter(([field, value]) => flattenLayout(before)[field] !== value)
            .map(([field, value]) => `${field}: ${value}`)
        return { changedFields: changes.join(", "), before, after }
    })
}

function listLayoutsInStepOrder(tabCount: number): ControlsRowLayout[] {
    const layouts: ControlsRowLayout[] = []
    const mostCompact = findControlsRowLayout(
        (layout) => {
            layouts.push(layout)
            return 1
        },
        0,
        tabCount
    )
    return [...layouts, mostCompact]
}

function flattenLayout(
    layout: ControlsRowLayout
): Record<string, string | number | boolean> {
    return {
        "tabs.labelMode": layout.tabs.labelMode,
        "tabs.paddingPx": layout.tabs.paddingPx,
        "tabs.visibleTabCount": layout.tabs.visibleTabCount,
        entityLabel: layout.entityLabel,
        settingsLabel: layout.settingsLabel,
        showTableFilter: layout.showTableFilter,
    }
}
