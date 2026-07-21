import * as _ from "lodash-es"
import { ContentSwitchers } from "../ContentSwitchers"
import {
    EntitySelectionToggle,
    EntityLabelMode,
} from "../EntitySelectionToggle"
import { SettingsMenu } from "../SettingsMenu"
import { MapResetButton } from "../MapResetButton"
import { MapZoomToSelectionButton } from "../MapZoomToSelectionButton"
import { MapRegionDropdown } from "../MapRegionDropdown"
import { MapZoomDropdown } from "../MapZoomDropdown"
import { DataTableFilterDropdown } from "../DataTableFilterDropdown"
import { DataTableSearchField } from "../DataTableSearchField"
import type { ControlsRowManager } from "./ControlsRow"
import { CONTROLS_GAP, CONTROLS_ROW_GAP } from "./ControlsRowConstants"

/**
 * The layout policy of the controls row: which labels and paddings are
 * dropped or reduced when the row runs out of horizontal space.
 */
export interface ControlsRowLayout {
    tabPadding: number
    showTabLabels: boolean
    entityLabelMode: EntityLabelMode
    showSettingsLabel: boolean
}

// Ordered from most to least verbose
// prettier-ignore
export const CONTROLS_ROW_LAYOUT_LADDER: ControlsRowLayout[] = [
    // Show all labels
    { tabPadding: 16, showTabLabels: true, entityLabelMode: "full", showSettingsLabel: true },
    // Reduce tab padding
    { tabPadding: 12, showTabLabels: true, entityLabelMode: "full", showSettingsLabel: true },
    // Hide settings label
    { tabPadding: 12, showTabLabels: true, entityLabelMode: "full", showSettingsLabel: false },
    // Shorten entity name ("Edit countries" for "Edit countries and regions")
    { tabPadding: 12, showTabLabels: true, entityLabelMode: "short", showSettingsLabel: false },
    // Hide tab labels
    { tabPadding: 12, showTabLabels: false, entityLabelMode: "short", showSettingsLabel: false },
    // Hide entity name ("Edit")
    { tabPadding: 12, showTabLabels: false, entityLabelMode: "action-only", showSettingsLabel: false },
    // Reduce tab padding further
    { tabPadding: 8, showTabLabels: false, entityLabelMode: "action-only", showSettingsLabel: false },
]

// Bounds.forText only approximates text widths, so leave a bit of headroom
const SAFETY_MARGIN = 8

/** Total width of the given controls, including the gaps between them */
function sumControlWidths(widths: number[]): number {
    const visibleWidths = widths.filter((width) => width > 0)
    const totalGaps = Math.max(0, visibleWidths.length - 1) * CONTROLS_GAP
    return _.sum(visibleWidths) + totalGaps
}

// mirrors ControlsRow.renderChartControls
function measureChartControlsWidth(
    manager: ControlsRowManager,
    layout: ControlsRowLayout
): number {
    return sumControlWidths([
        EntitySelectionToggle.estimateWidth(manager, {
            entityLabelMode: layout.entityLabelMode,
        }),
        SettingsMenu.estimateWidth(manager, {
            showLabel: layout.showSettingsLabel,
        }),
    ])
}

// mirrors ControlsRow.renderMapControls
function measureMapControlsWidth(
    manager: ControlsRowManager,
    layout: ControlsRowLayout
): number {
    if (!manager.isMapSelectionEnabled) {
        // mirrors ControlsRow.renderMapControlsForMobile
        const resetZoomWidth = MapResetButton.estimateWidth(
            manager,
            "resetZoom"
        )
        if (resetZoomWidth > 0) return resetZoomWidth
        return manager.isFaceted
            ? MapRegionDropdown.estimateWidth(manager)
            : MapZoomDropdown.estimateWidth(manager)
    }

    // mirrors ControlsRow.renderMapControlsForDesktop
    return sumControlWidths([
        MapResetButton.estimateWidth(manager, "resetZoom"),
        MapZoomToSelectionButton.estimateWidth(manager),
        MapResetButton.estimateWidth(manager, "resetView"),
        MapRegionDropdown.estimateWidth(manager),
        EntitySelectionToggle.estimateWidth(manager, {
            entityLabelMode: layout.entityLabelMode,
        }),
    ])
}

// mirrors ControlsRow.renderTableControls
function measureTableControlsWidth(manager: ControlsRowManager): number {
    return sumControlWidths([
        DataTableFilterDropdown.estimateWidth(manager),
        DataTableSearchField.estimateWidth(manager),
    ])
}

function measureControlsWidth(
    manager: ControlsRowManager,
    layout: ControlsRowLayout
): number {
    if (manager.isOnMapTab) return measureMapControlsWidth(manager, layout)
    if (manager.isOnTableTab) return measureTableControlsWidth(manager)
    return measureChartControlsWidth(manager, layout)
}

/** Estimated width of the controls row's content in the given layout */
export function measureControlsRowWidth(
    manager: ControlsRowManager,
    layout: ControlsRowLayout
): number {
    const tabsWidth = ContentSwitchers.estimateWidth(manager, {
        showTabLabels: layout.showTabLabels,
        tabPadding: layout.tabPadding,
    })
    const controlsWidth = measureControlsWidth(manager, layout)
    if (tabsWidth === 0) return controlsWidth
    if (controlsWidth === 0) return tabsWidth
    return tabsWidth + CONTROLS_ROW_GAP + controlsWidth
}

/**
 * Pick the most verbose layout of the controls row that fits into the given
 * width. If none fits, the least verbose one is returned.
 */
export function chooseControlsRowLayout(
    manager: ControlsRowManager,
    maxWidth: number
): ControlsRowLayout {
    for (const layout of CONTROLS_ROW_LAYOUT_LADDER) {
        if (
            measureControlsRowWidth(manager, layout) + SAFETY_MARGIN <=
            maxWidth
        )
            return layout
    }
    return CONTROLS_ROW_LAYOUT_LADDER[CONTROLS_ROW_LAYOUT_LADDER.length - 1]
}
