import { OwidDistinctColors } from "@ourworldindata/grapher/src/color/CustomSchemes.js"
import {
    GRAY_5,
    GRAY_20,
    GRAY_60,
    GRAPHER_BACKGROUND,
    GRAPHER_DARK_TEXT,
    GRAPHER_LIGHT_TEXT,
} from "@ourworldindata/grapher/src/color/ColorConstants.js"

export const COLORS = {
    background: GRAPHER_BACKGROUND,
    /** A step that adds to the running balance */
    add: OwidDistinctColors.TealishGreen,
    /** A step that subtracts from it */
    subtract: OwidDistinctColors.RustyOrange,
    /** The food available to eat */
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
/** Line height of a value label with its unit on a second line, relative to its font size */
export const VALUE_LABEL_LINE_HEIGHT = 1.1
export const TOTAL_LABEL_FONT_SIZE = 14
export const TOTAL_LABEL_FONT_WEIGHT = 700
export const CAPTION_FONT_SIZE = 12
export const CAPTION_FONT_WEIGHT = 400
export const GROUP_LABEL_FONT_SIZE = 13
export const GROUP_LABEL_FONT_WEIGHT = 700
export const TOTAL_BOX_LABEL_FONT_WEIGHT = 600
export const MAX_CAPTION_LINES = 3
/** Minimum space between a column's value label and the next column's bar */
export const MIN_LABEL_SPACING = 6

/** Space between a tick label and the plot */
export const TICK_LABEL_GAP = 8
export const PLOT_MARGIN_RIGHT = 8
export const PLOT_MARGIN_BOTTOM = 6
export const CONNECTOR_WIDTH = 1
/** Outline around step labels that masks the lines behind them */
export const LABEL_HALO_WIDTH = 3
/** Space between a bar and its value label */
export const VALUE_LABEL_GAP = 8
/** Space between a step's caption and the value label below it */
export const CAPTION_VALUE_LABEL_GAP = 3
/** Space between an arrow's ends and its bar's ends */
export const ARROW_INSET = 8
/** Shortest arrow drawn inside a bar */
export const ARROW_MIN_LENGTH = 10
export const ARROW_WIDTH = 1.5
export const ARROW_OPACITY = 0.8
/** Space between a group's label and the tallest caption below it */
export const GROUP_LABEL_GAP = 8
/** Inset between a group's box and the label in its corner */
export const GROUP_LABEL_INSET = 10
export const GROUP_BOX_CORNER_RADIUS = 2

/** Narrowest column the vertical chart draws before the chart turns horizontal */
export const MIN_VERTICAL_SLOT_WIDTH = 44
export const VERTICAL_CHART_HEIGHT = 400

/** The horizontal chart's widest caption column, as a share of its width */
export const MAX_CAPTION_COLUMN_SHARE = 0.4
export const MAX_ROW_CAPTION_LINES = 2
/** Space between the caption column and the plot */
export const CAPTION_COLUMN_GAP = 8
/** Space above and below a row's caption */
export const ROW_PADDING = 4
export const MIN_ROW_HEIGHT = 24
/** Space between a group box's top and its header */
export const GROUP_HEADER_INSET = 6
/** Space between a group's header and its first row */
export const GROUP_HEADER_GAP = 6
/** Space between neighbouring boxes in the horizontal chart, beyond what their overhang leaves */
export const BOX_GAP = 8
/** Space between a bar and its value label, beside it */
export const VALUE_LABEL_SIDE_GAP = 4
/** Minimum space between neighbouring tick labels */
export const MIN_TICK_LABEL_SPACING = 8
