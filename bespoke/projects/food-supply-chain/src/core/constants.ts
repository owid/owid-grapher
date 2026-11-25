import { OwidDistinctColors } from "@ourworldindata/grapher/src/color/CustomSchemes.js"
import {
    GRAY_5,
    GRAY_20,
    GRAY_60,
    GRAPHER_BACKGROUND,
    GRAPHER_DARK_TEXT,
    GRAPHER_LIGHT_TEXT,
} from "@ourworldindata/grapher/src/color/ColorConstants.js"

import type { Measure } from "./types.js"

export const SHORT_UNIT_BY_MEASURE: Record<Measure, string> = {
    calories: "kcal",
    protein: "g",
}

export const NUM_DECIMAL_PLACES_BY_MEASURE: Record<Measure, number> = {
    calories: 0,
    protein: 1,
}

export const COLORS = {
    background: GRAPHER_BACKGROUND,
    add: OwidDistinctColors.TealishGreen,
    subtract: OwidDistinctColors.RustyOrange,
    unchanged: GRAPHER_LIGHT_TEXT,
    total: OwidDistinctColors.MidnightBlue,
    gridline: GRAY_20,
    zeroLine: GRAY_60,
    tickLabel: GRAPHER_LIGHT_TEXT,
    arrow: "#fff",
    caption: GRAPHER_DARK_TEXT,
    groupBox: GRAY_5,
    groupLabel: GRAPHER_DARK_TEXT,
    totalBox: "#ebf0f7",
    totalLabel: OwidDistinctColors.MidnightBlue,
}

export const TICK_LABEL_FONT_SIZE = 11
export const VALUE_LABEL_FONT_SIZE = 12
export const VALUE_LABEL_FONT_WEIGHT = 600
export const TOTAL_LABEL_FONT_SIZE = 14
export const TOTAL_LABEL_FONT_WEIGHT = 700
export const CAPTION_FONT_WEIGHT = 400
export const GROUP_LABEL_FONT_WEIGHT = 700

export const TICK_LABEL_GAP = 8
export const PLOT_MARGIN_BOTTOM = 6
export const CONNECTOR_WIDTH = 1
export const LABEL_HALO_WIDTH = 3
export const ARROW_INSET = 8
export const ARROW_MIN_LENGTH = 10
export const ARROW_WIDTH = 1.5
export const ARROW_OPACITY = 0.8
export const GROUP_LABEL_INSET = 10
export const GROUP_BOX_CORNER_RADIUS = 2

export const VERTICAL_CHART_HEIGHT = 400
export const MIN_VERTICAL_SLOT_WIDTH = 44
export const VERTICAL_CAPTION_FONT_SIZE = 11
export const VERTICAL_GROUP_LABEL_FONT_SIZE = 13
export const MAX_COLUMN_CAPTION_LINES = 4
export const MAX_CAPTION_OVERFLOW = 8
export const MIN_LABEL_SPACING = 6
export const VALUE_LABEL_GAP = 8
export const CAPTION_VALUE_LABEL_GAP = 3
export const GROUP_LABEL_GAP = 8

export const HORIZONTAL_CAPTION_FONT_SIZE = 12
export const TOTAL_ROW_CAPTION_FONT_WEIGHT = 600
export const VALUE_LABEL_BASELINE_OFFSET = 0.37
export const MAX_ROW_CAPTION_SHARE = 0.4
export const MAX_ROW_CAPTION_LINES = 2
export const CAPTION_COLUMN_GAP = 8
export const ROW_PADDING = 4
export const MIN_ROW_HEIGHT = 24
export const GROUP_HEADER_TOP_GAP = 6
export const GROUP_HEADER_GAP = 6
export const BOX_GAP = 8
export const VALUE_LABEL_SIDE_GAP = 4
export const MIN_TICK_LABEL_SPACING = 8
