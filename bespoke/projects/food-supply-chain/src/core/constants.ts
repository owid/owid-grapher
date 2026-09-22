import { OwidDistinctColors } from "@ourworldindata/grapher/src/color/CustomSchemes.js"
import {
    GRAY_20,
    GRAY_30,
    GRAY_50,
    GRAY_60,
    GRAPHER_DARK_TEXT,
    GRAPHER_LIGHT_TEXT,
} from "@ourworldindata/grapher/src/color/ColorConstants.js"

export const COLORS = {
    /** A step that adds to the running balance */
    add: OwidDistinctColors.Teal,
    /** A step that subtracts from it */
    subtract: OwidDistinctColors.DarkOrange,
    /** The food available to eat */
    total: OwidDistinctColors.MidnightBlue,
    gridline: GRAY_20,
    zeroLine: GRAY_60,
    connector: GRAY_50,
    tickLabel: GRAPHER_LIGHT_TEXT,
    valueLabel: GRAPHER_DARK_TEXT,
    caption: GRAPHER_LIGHT_TEXT,
    groupBand: GRAY_30,
    groupLabel: GRAPHER_DARK_TEXT,
}

export const TICK_LABEL_FONT_SIZE = 12
export const VALUE_LABEL_FONT_SIZE = 11
export const CAPTION_FONT_SIZE = 11
export const GROUP_LABEL_FONT_SIZE = 11
export const GROUP_LABEL_FONT_WEIGHT = 700
export const MAX_CAPTION_LINES = 3

/** Left margin, wide enough for the longest tick label the data produces */
export const AXIS_LABEL_WIDTH = 56
export const PLOT_MARGIN_TOP = 16
export const PLOT_MARGIN_RIGHT = 8
export const CAPTION_GAP = 8
export const VALUE_LABEL_GAP = 4
export const GROUP_BAND_GAP = 12
export const GROUP_LABEL_GAP = 5
