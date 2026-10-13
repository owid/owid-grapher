import { formatValue } from "@ourworldindata/utils"
import { OwidVariableRoundingMode } from "@ourworldindata/types"

export function formatCount(
    value: number,
    { abbreviate = true }: { abbreviate?: boolean } = {}
): string {
    return formatValue(value, {
        roundingMode: OwidVariableRoundingMode.significantFigures,
        numSignificantFigures: 3,
        numberAbbreviation: abbreviate ? "long" : false,
        trailingZeroes: false,
    })
}

export function formatExactCount(value: number): string {
    return formatValue(value, {
        roundingMode: OwidVariableRoundingMode.decimalPlaces,
        numDecimalPlaces: 0,
        numberAbbreviation: false,
    })
}

export function formatShare(value: number): string {
    // Don't round a share that isn't the whole up to "100%"
    if (value < 1 && value >= 0.995) return ">99%"

    return formatValue(value * 100, {
        roundingMode: OwidVariableRoundingMode.significantFigures,
        numSignificantFigures: 2,
        unit: "%",
        numberAbbreviation: false,
        trailingZeroes: false,
    })
}

export const minBy = <T>(array: T[], selector: (item: T) => number): number => {
    return Math.min(...array.map(selector))
}

export const maxBy = <T>(array: T[], selector: (item: T) => number): number => {
    return Math.max(...array.map(selector))
}

/** "the " for region names that take an article mid-sentence */
export function regionArticle(regionName: string): string {
    return regionName === "Americas" || regionName === "Middle East"
        ? "the "
        : ""
}
