import { formatValue } from "@ourworldindata/utils"
import { OwidVariableRoundingMode } from "@ourworldindata/types"

/** Format a number of people, e.g. "846 million" */
export function formatCount(value: number): string {
    return formatValue(value, {
        roundingMode: OwidVariableRoundingMode.significantFigures,
        numSignificantFigures: 3,
        numberAbbreviation: "long",
        trailingZeroes: false,
    })
}

/** Format a headcount ratio given in percent, e.g. "10.4%" */
export function formatShare(percent: number): string {
    return formatValue(percent, {
        roundingMode: OwidVariableRoundingMode.significantFigures,
        numSignificantFigures: 2,
        unit: "%",
        numberAbbreviation: false,
        trailingZeroes: false,
    })
}

/** Format a y-axis tick for the number of people, e.g. "1 billion" */
export function formatCountAxisTick(value: number): string {
    if (value === 0) return "0"
    return formatValue(value, {
        numDecimalPlaces: 1,
        numberAbbreviation: "long",
        trailingZeroes: false,
    })
}

/** Format a y-axis tick for a share, e.g. "40%" */
export function formatShareAxisTick(percent: number): string {
    return `${percent}%`
}
