import { BASE_FONT_SIZE } from "../core/GrapherConstants"

// not sure if we want to do something more sophisticated
export const getFontSize = (
    count: number,
    baseFontSize = BASE_FONT_SIZE,
    minSize = 8
): number => {
    if (count <= 2) return Math.max(minSize, baseFontSize * (16 / 16))
    if (count <= 4) return Math.max(minSize, baseFontSize * (14 / 16))
    if (count <= 9) return Math.max(minSize, baseFontSize * (12 / 16))
    if (count <= 16) return Math.max(minSize, baseFontSize * (10 / 16))
    if (count <= 25) return Math.max(minSize, baseFontSize * (8 / 16))
    return minSize
}

export const getChartPadding = (
    count: number
): { rowPadding: number; columnPadding: number; outerPadding: number } => {
    if (count > 9) {
        return {
            rowPadding: 30,
            columnPadding: 10,
            outerPadding: 0,
        }
    }

    return {
        rowPadding: 50,
        columnPadding: 40,
        outerPadding: 0,
    }
}
