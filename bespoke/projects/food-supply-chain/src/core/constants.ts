import { OwidDistinctColors } from "@ourworldindata/grapher/src/color/CustomSchemes.js"
import {
    GRAY_5,
    GRAY_20,
    GRAY_50,
    GRAY_60,
    GRAPHER_DARK_TEXT,
    GRAPHER_LIGHT_TEXT,
} from "@ourworldindata/grapher/src/color/ColorConstants.js"

export const COLORS = {
    /** A step that adds to the running balance */
    add: OwidDistinctColors.TealishGreen,
    /** A step that subtracts from it */
    subtract: OwidDistinctColors.RustyOrange,
    /** The food available to eat */
    total: OwidDistinctColors.MidnightBlue,
    gridline: GRAY_20,
    zeroLine: GRAY_60,
    connector: GRAY_50,
    tickLabel: GRAPHER_LIGHT_TEXT,
    valueLabelInsideBar: "#fff",
    caption: GRAPHER_LIGHT_TEXT,
    groupBox: GRAY_5,
    groupLabelBox: GRAY_20,
    groupLabel: GRAPHER_DARK_TEXT,
}

export const TICK_LABEL_FONT_SIZE = 12
export const VALUE_LABEL_FONT_SIZE = 12
export const VALUE_LABEL_FONT_WEIGHT = 700
export const TOTAL_LABEL_FONT_SIZE = 14
export const CAPTION_FONT_SIZE = 12
export const GROUP_LABEL_FONT_SIZE = 11
export const GROUP_LABEL_FONT_WEIGHT = 700
export const MAX_CAPTION_LINES = 3

/** Left margin, wide enough for the longest tick label the data produces */
export const AXIS_LABEL_WIDTH = 56
export const PLOT_MARGIN_TOP = 24
export const PLOT_MARGIN_RIGHT = 8
export const CAPTION_GAP = 8
export const TOTAL_LABEL_GAP = 8
/** Minimum space between a label inside a bar and the bar's edges */
export const VALUE_LABEL_INSET = 4
/** Distance from a bar's far end to the base of its arrow */
export const ARROW_GAP = 1
export const ARROW_HEIGHT = 10
export const ARROW_HALF_WIDTH = 8
export const GROUP_LABEL_GAP = 16
/** Inset between a group's label box and the label it encloses */
export const GROUP_BOX_PADDING = 6
export const GROUP_BOX_CORNER_RADIUS = 2
