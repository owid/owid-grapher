import { Color } from "../../coreTable/CoreTableConstants"
import { rgb, color, RGBColor } from "d3-color"
import { interpolate } from "d3-interpolate"
import { difference, groupBy, minBy } from "../../clientUtils/Util"

export const interpolateArray = (
    scaleArr: string[]
): ((t: number) => string) => {
    const N = scaleArr.length - 2 // -1 for spacings, -1 for number of interpolate fns
    const intervalWidth = 1 / N
    const intervals: Array<(t: number) => string> = []

    for (let i = 0; i <= N; i++) {
        intervals[i] = interpolate(rgb(scaleArr[i]), rgb(scaleArr[i + 1]))
    }

    return (t: number): string => {
        if (t < 0 || t > 1)
            throw new Error("Outside the allowed range of [0, 1]")

        const i = Math.floor(t * N)
        const intervalOffset = i * intervalWidth

        return intervals[i](t / intervalWidth - intervalOffset / intervalWidth)
    }
}

export function getLeastUsedColor(
    availableColors: Color[],
    usedColors: Color[]
): Color | undefined {
    // If there are unused colors, return the first available
    const unusedColors = difference(availableColors, usedColors)
    if (unusedColors.length > 0) return unusedColors[0]

    // If all colors are used, we want to count the times each color is used, and use the most
    // unused one.
    const colorCounts = Object.entries(groupBy(usedColors)).map(
        ([color, arr]): any[] => [color, arr.length]
    )
    const mostUnusedColor = minBy(colorCounts, ([, count]) => count) as [
        string,
        number
    ]
    return mostUnusedColor[0]
}

// Taken from https://github.com/Qix-/color/blob/594a9af778f9a89541510bd1ae24061c82f24693/index.js#L287-L292
function getYiq(rgb: RGBColor): number {
    // YIQ equation from http://24ways.org/2010/calculating-color-contrast
    return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000
}

export function isDarkColor(colorSpecifier: string): boolean | undefined {
    const rgb = color(colorSpecifier)?.rgb()
    if (!rgb) return undefined
    return getYiq(rgb) < 128
}

// See https://observablehq.com/@danielgavrilov/darken-colors-to-meet-a-target-contrast-ratio
function darkenColorToTargetYiq(colorHex: Color, targetYiq: number): Color {
    const c = color(colorHex)?.rgb()
    if (!c) return colorHex
    const darkenCoeff = getYiq(c) / targetYiq - 1.0
    if (darkenCoeff > 0) return c.darker(darkenCoeff).hex()
    return c.hex()
}

export function darkenColorForLine(colorHex: Color): Color {
    return darkenColorToTargetYiq(colorHex, 170)
}

export function darkenColorForText(colorHex: Color): Color {
    return darkenColorToTargetYiq(colorHex, 125)
}
