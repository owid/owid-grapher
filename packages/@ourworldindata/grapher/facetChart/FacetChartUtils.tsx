import { BASE_FONT_SIZE } from "../core/GrapherConstants.js"

// not sure if we want to do something more sophisticated
export const getFontSize = (
    count: number,
    baseFontSize = BASE_FONT_SIZE,
    minSize = 8
): number => {
    if (count <= 2) return Math.max(minSize, baseFontSize * (15 / 16))
    if (count <= 4) return Math.max(minSize, baseFontSize * (14 / 16))
    if (count <= 9) return Math.max(minSize, baseFontSize * (13 / 16))
    if (count <= 16) return Math.max(minSize, baseFontSize * (12 / 16))
    if (count <= 25) return Math.max(minSize, baseFontSize * (11 / 16))
    return minSize
}

export const getChartPadding = (
    count: number,
    baseFontSize: number
): { rowPadding: number; columnPadding: number; outerPadding: number } => {
    return {
        rowPadding: Math.round(baseFontSize * 3.5),
        columnPadding: Math.round(baseFontSize),
        outerPadding: 0,
    }
}
