import * as _ from "lodash-es"
import { IDEAL_PLOT_ASPECT_RATIO } from "@ourworldindata/utils"
import {
    BASE_FONT_SIZE,
    GRAPHER_FONT_SCALE_11,
    GRAPHER_FONT_SCALE_15,
} from "../core/GrapherConstants"
import { roundFontSize } from "../chart/ChartUtils"

const SMALL_CELL_LENGTH = 125
const LARGE_CELL_LENGTH = 490

/** Chooses a facet label font size from the size of a single facet cell */
export const getFacetLabelFontSize = ({
    cellWidth,
    cellHeight,
    baseFontSize = BASE_FONT_SIZE,
    minSize = 8,
}: {
    cellWidth: number
    cellHeight: number
    baseFontSize?: number
    minSize?: number
}): number => {
    const minFontSize = Math.max(minSize, GRAPHER_FONT_SCALE_11 * baseFontSize)
    const maxFontSize =
        GRAPHER_FONT_SCALE_15 * Math.min(baseFontSize, BASE_FONT_SIZE)

    // Available room as a single number (width-pixels): the width, but capped at
    // what it'd be at the ideal aspect ratio, so short-and-wide cells are driven
    // by their height and tall-or-square cells by their width
    const length = Math.min(cellWidth, cellHeight * IDEAL_PLOT_ASPECT_RATIO)

    // Where `length` falls in the small→large cell range, as a 0–1 fraction
    const sizeFraction = _.clamp(
        (length - SMALL_CELL_LENGTH) / (LARGE_CELL_LENGTH - SMALL_CELL_LENGTH),
        0,
        1
    )

    // Interpolate between the floor and ceiling
    const fontSize = minFontSize + sizeFraction * (maxFontSize - minFontSize)

    return roundFontSize(fontSize)
}

export const calculateAspectRatio = (width: number, height: number): number => {
    const aspectRatio = width / height // can be NaN if height is 0, which can happen when the chart is temporarily hidden
    if (isNaN(aspectRatio)) return 1
    return aspectRatio
}
