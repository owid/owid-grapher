import { formatValue } from "@ourworldindata/utils"
import { OwidVariableRoundingMode } from "@ourworldindata/types"

export const formatPeople = (v: number): string =>
    formatValue(v, {
        unit: "people",
        numberAbbreviation: "long",
        roundingMode: OwidVariableRoundingMode.significantFigures,
        numSignificantFigures: 2,
    })

export function formatShare(share: number): string {
    const pct = share * 100
    if (!isFinite(pct) || pct <= 0) return ""
    return formatValue(pct, {
        unit: "%",
        numberAbbreviation: false,
        roundingMode: OwidVariableRoundingMode.significantFigures,
        numSignificantFigures: 2,
    })
}

export const capitalize = (s: string): string =>
    s.charAt(0).toUpperCase() + s.slice(1)

/** Cap a list to 8 visible items, returning the remainder count */
export function capItems<T>(items: T[]): { visible: T[]; hiddenCount: number } {
    const showAll = items.length <= 10
    const visible = showAll ? items : items.slice(0, 8)
    return { visible, hiddenCount: items.length - visible.length }
}
