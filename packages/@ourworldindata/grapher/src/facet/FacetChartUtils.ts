import {
    BASE_FONT_SIZE,
    GRAPHER_FONT_SCALE_10,
    GRAPHER_FONT_SCALE_11,
    GRAPHER_FONT_SCALE_12,
    GRAPHER_FONT_SCALE_12_8,
} from "../core/GrapherConstants"

export const getFacetLabelFontSize = ({
    containerWidth,
    count,
    baseFontSize = BASE_FONT_SIZE,
    minSize = 8,
}: {
    containerWidth: number
    count: number
    baseFontSize?: number
    minSize?: number
}): number => {
    // Pick a fixed font size for very small charts
    if (containerWidth < 300) return GRAPHER_FONT_SCALE_10 * baseFontSize

    // Scale the font size based on the number of series otherwise
    if (count <= 9)
        return Math.max(minSize, baseFontSize * GRAPHER_FONT_SCALE_12_8)
    if (count <= 16)
        return Math.max(minSize, baseFontSize * GRAPHER_FONT_SCALE_12)
    if (count <= 25)
        return Math.max(minSize, baseFontSize * GRAPHER_FONT_SCALE_11)

    return minSize
}

export const getFacetGridPadding = ({
    labelFontSize,
    labelPadding,
    shouldAddRowPadding = true,
    shouldAddColumnPadding = true,
}: {
    labelFontSize: number
    labelPadding: number
    shouldAddRowPadding?: boolean
    shouldAddColumnPadding?: boolean
}): { rowPadding: number; columnPadding: number; outerPadding: number } => {
    const labelHeight = labelFontSize

    const rowPadding = shouldAddRowPadding ? labelFontSize : 0
    const columnPadding = shouldAddColumnPadding ? labelFontSize : 0

    return {
        rowPadding: Math.round(labelHeight + labelPadding + rowPadding),
        columnPadding: Math.round(columnPadding),
        outerPadding: 0,
    }
}

export const calculateAspectRatio = (width: number, height: number): number => {
    const aspectRatio = width / height // can be NaN if height is 0, which can happen when the chart is temporarily hidden
    if (isNaN(aspectRatio)) return 1
    return aspectRatio
}
