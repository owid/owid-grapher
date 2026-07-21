import type { CSSProperties } from "react"
import type { FontSettings } from "../../core/GrapherConstants"
import { textWidth } from "../../chart/ChartUtils"

/**
 * Sizing constants and measurement primitives for the controls row.
 *
 * The constants are the single source of truth: the controls' estimateWidth
 * statics use them to estimate how much space the row's content needs, and
 * ControlsRow injects them as CSS custom properties that the stylesheets
 * read, so the rendered sizes can't drift away from the estimated ones.
 */

// Buttons (button.menu-toggle, styled in Controls.scss)
const BUTTON_FONT_SIZE = 13
const BUTTON_FONT_WEIGHT = 400
const BUTTON_PADDING = 7
const BUTTON_BORDER_WIDTH = 1
const BUTTON_ICON_WIDTH = 13
const BUTTON_ICON_MARGIN = 5
const ICON_ONLY_BUTTON_ICON_MARGIN = 2
// The GlobeIcon in MapZoomToSelectionButton.tsx, sized via its `size` prop
export const ZOOM_TO_SELECTION_ICON_WIDTH = 16

// Applies to both button and tab labels
const LABEL_LETTER_SPACING_EM = 0.01

// Gap between the buttons in nav.controlsRow .controls (Controls.scss)
export const CONTROLS_GAP = 8
// Flex gap between the content switchers and the controls (CaptionedChart.scss)
export const CONTROLS_ROW_GAP = 16

// Slim tabs (Tabs.scss and ContentSwitchers.scss)
export const TABS_FRAME_PADDING = 2
const TAB_FONT_SIZE = 13
const TAB_FONT_WEIGHT = 500
export const TAB_ICON_WIDTH = 13
export const TAB_ICON_GAP = 6
export const OVERFLOW_BUTTON_PADDING = 8

// Dropdowns, honored as their flex-basis (or width) in the respective .scss files
export const MAP_REGION_DROPDOWN_WIDTH = 155
export const MAP_ZOOM_DROPDOWN_WIDTH = 202
export const DATA_TABLE_FILTER_DROPDOWN_WIDTH = 194
export const DATA_TABLE_SEARCH_FIELD_WIDTH = 208

/**
 * Injected on controlsRow so the stylesheets render exactly the sizes
 * that ControlsRowLayout.ts assumes.
 */
export const CONTROLS_ROW_CSS_VARIABLES = {
    "--button-font-size": `${BUTTON_FONT_SIZE}px`,
    "--button-font-weight": `${BUTTON_FONT_WEIGHT}`,
    "--button-padding": `${BUTTON_PADDING}px`,
    "--button-border-width": `${BUTTON_BORDER_WIDTH}px`,
    "--button-icon-width": `${BUTTON_ICON_WIDTH}px`,
    "--button-icon-margin": `${BUTTON_ICON_MARGIN}px`,
    "--icon-only-button-icon-margin": `${ICON_ONLY_BUTTON_ICON_MARGIN}px`,
    "--label-letter-spacing": `${LABEL_LETTER_SPACING_EM}em`,
    "--controls-gap": `${CONTROLS_GAP}px`,
    "--controls-row-gap": `${CONTROLS_ROW_GAP}px`,
    "--tabs-frame-padding": `${TABS_FRAME_PADDING}px`,
    "--tabs-font-size": `${TAB_FONT_SIZE}px`,
    "--tab-font-weight": `${TAB_FONT_WEIGHT}`,
    "--tab-icon-width": `${TAB_ICON_WIDTH}px`,
    "--tab-icon-gap": `${TAB_ICON_GAP}px`,
    "--overflow-button-padding": `${OVERFLOW_BUTTON_PADDING}px`,
    "--map-region-dropdown-width": `${MAP_REGION_DROPDOWN_WIDTH}px`,
    "--map-zoom-dropdown-width": `${MAP_ZOOM_DROPDOWN_WIDTH}px`,
    "--data-table-filter-dropdown-width": `${DATA_TABLE_FILTER_DROPDOWN_WIDTH}px`,
    "--data-table-search-field-width": `${DATA_TABLE_SEARCH_FIELD_WIDTH}px`,
} as CSSProperties

/**
 * The tabs' overflow menu renders into a portal outside of controlsRow,
 * so the tab content variables need to be injected on the popover separately.
 */
export const TAB_CONTENT_CSS_VARIABLES = {
    "--tab-icon-width": `${TAB_ICON_WIDTH}px`,
    "--tab-icon-gap": `${TAB_ICON_GAP}px`,
} as CSSProperties

type MeasuredFontSettings = Pick<
    FontSettings,
    "fontSize" | "fontWeight" | "letterSpacing"
>

const BUTTON_FONT: MeasuredFontSettings = {
    fontSize: BUTTON_FONT_SIZE,
    fontWeight: BUTTON_FONT_WEIGHT,
    letterSpacing: LABEL_LETTER_SPACING_EM,
}
export const TAB_FONT: MeasuredFontSettings = {
    fontSize: TAB_FONT_SIZE,
    fontWeight: TAB_FONT_WEIGHT,
    letterSpacing: LABEL_LETTER_SPACING_EM,
}

/** Width of a button.menu-toggle. Icon-only if no label is given. */
export function measureButtonWidth(
    label: string | undefined,
    iconWidth: number = BUTTON_ICON_WIDTH
): number {
    const frameWidth = 2 * (BUTTON_PADDING + BUTTON_BORDER_WIDTH)
    if (label === undefined)
        return frameWidth + 2 * ICON_ONLY_BUTTON_ICON_MARGIN + iconWidth
    return (
        frameWidth +
        iconWidth +
        BUTTON_ICON_MARGIN +
        textWidth(label, BUTTON_FONT)
    )
}
