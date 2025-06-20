import { BASE_FONT_SIZE, GRAPHER_FONT_SCALE_10 } from "../core/GrapherConstants"

// not sure if we want to do something more sophisticated
export const getFontSize = (
    containerWidth: number,
    count: number,
    baseFontSize = BASE_FONT_SIZE,
    minSize = 8
): number => {
    // Pick a fixed font size for very small charts
    if (containerWidth < 300) return GRAPHER_FONT_SCALE_10 * baseFontSize

    // Scale the font size based on the number of series otherwise
    if (count <= 2) return Math.max(minSize, baseFontSize * (15 / 16))
    if (count <= 4) return Math.max(minSize, baseFontSize * (14 / 16))
    if (count <= 9) return Math.max(minSize, baseFontSize * (13 / 16))
    if (count <= 16) return Math.max(minSize, baseFontSize * (12 / 16))
    if (count <= 25) return Math.max(minSize, baseFontSize * (11 / 16))
    return minSize
}

export const getLabelPadding = (baseFontSize: number): number =>
    0.5 * baseFontSize

export const getFacetGridPadding = ({
    baseFontSize,
    shouldAddRowPadding = true,
    shouldAddColumnPadding = true,
}: {
    baseFontSize: number
    shouldAddRowPadding?: boolean
    shouldAddColumnPadding?: boolean
}): { rowPadding: number; columnPadding: number; outerPadding: number } => {
    const labelHeight = baseFontSize
    const labelPadding = getLabelPadding(baseFontSize)

    const rowPadding = shouldAddRowPadding ? baseFontSize : 0
    const columnPadding = shouldAddColumnPadding ? baseFontSize : 0

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
