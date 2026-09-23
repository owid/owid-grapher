import { formatValue } from "@ourworldindata/utils"
import { OwidVariableRoundingMode } from "@ourworldindata/types"

import { TradeRow, TradeSeries } from "./types.js"

/** Hectares of amortized deforestation risk, e.g. "1.2 million hectares", or
 *  "1.2 million ha" in the short form used for chart labels. Numbers are never
 *  abbreviated to "k" or "M". Values below 10 get one significant figure, like
 *  migration's `formatPeople`, so a rounded "8 hectares" doesn't read as more
 *  precise than it is. */
export const formatHectares = (
    v: number,
    opts?: { short?: boolean }
): string => {
    const numSignificantFigures = v < 10 ? 1 : 2

    return formatValue(v, {
        unit: opts?.short ? "ha" : "hectares",
        numberAbbreviation: "long",
        roundingMode: OwidVariableRoundingMode.significantFigures,
        numSignificantFigures,
    })
}

export function formatShare(share: number): string {
    const pct = share * 100
    if (!isFinite(pct) || pct <= 0) return ""
    if (pct < 0.01) return "<0.01%"
    return formatValue(pct, {
        unit: "%",
        numberAbbreviation: false,
        roundingMode: OwidVariableRoundingMode.significantFigures,
        numSignificantFigures: 2,
    })
}

/** Possessive form of an articulated entity name — "the United States'",
 *  "Brazil's". Used in generated titles. */
export function possessiveEntity(articulatedName: string): string {
    return articulatedName.endsWith("s")
        ? `${articulatedName}'`
        : `${articulatedName}'s`
}

/** Cap a list to 8 visible items, returning the remainder count */
export function capItems<T>(items: T[]): { visible: T[]; hiddenCount: number } {
    const showAll = items.length <= 10
    const visible = showAll ? items : items.slice(0, 8)
    return { visible, hiddenCount: items.length - visible.length }
}

/** Slice every series at one year, dropping the gaps. A `null` is "no data"
 *  and a zero or negative value carries no flow, so neither becomes a link. */
export function rowsForYear(
    series: TradeSeries[],
    yearIndex: number
): TradeRow[] {
    const rows: TradeRow[] = []
    for (const s of series) {
        const value = s.values[yearIndex]
        if (value === null || value === undefined || value <= 0) continue
        rows.push({ partner: s.partner, group: s.group, value })
    }
    return rows
}

export function sumRows(rows: TradeRow[]): number {
    let total = 0
    for (const row of rows) total += row.value
    return total
}
