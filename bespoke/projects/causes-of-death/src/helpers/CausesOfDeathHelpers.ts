import { articulateEntity, formatValue } from "@ourworldindata/utils"
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

export function formatShare(value: number): string {
    return formatValue(value * 100, {
        roundingMode: OwidVariableRoundingMode.significantFigures,
        numSignificantFigures: 2,
        unit: "%",
        numberAbbreviation: false,
        trailingZeroes: false,
    })
}

export function formatCountryName(countryName: string): string {
    return articulateEntity(countryName)
}

export const minBy = <T>(array: T[], selector: (item: T) => number): number => {
    return Math.min(...array.map(selector))
}

export const maxBy = <T>(array: T[], selector: (item: T) => number): number => {
    return Math.max(...array.map(selector))
}
