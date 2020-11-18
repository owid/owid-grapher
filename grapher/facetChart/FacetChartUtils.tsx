import { BASE_FONT_SIZE } from "grapher/core/GrapherConstants"

// not sure if we want to do something more sophisticated
export const getFontSize = (
    count: number,
    baseFontSize = BASE_FONT_SIZE,
    min = 8
) => {
    if (count === 2) return baseFontSize
    if (count < 5) return baseFontSize - 2
    if (count < 10) return baseFontSize - 4
    if (count < 17) return baseFontSize - 6
    if (count < 36) return baseFontSize - 8
    return min
}

export const getChartPadding = (count: number) => {
    if (count > 9) {
        return {
            rowPadding: 20,
            columnPadding: 20,
            outerPadding: 20,
        }
    }

    return {
        rowPadding: 40,
        columnPadding: 40,
        outerPadding: 20,
    }
}
