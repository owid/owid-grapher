import { formatValue } from "@ourworldindata/utils"
import { OwidVariableRoundingMode } from "@ourworldindata/types"

import {
    Period,
    TradeRow,
    TradeSeries,
    WorldGroupTotal,
    YearRange,
} from "./types.js"

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

/** How many years a preset period spans; `undefined` for a single year */
export function getPeriodLength(period: Period): number | undefined {
    switch (period) {
        case "single-year":
            return undefined
        case "last-5-years":
            return 5
        case "last-10-years":
            return 10
    }
}

/**
 * The inclusive index range of `years` a period covers. A preset ends at the
 * most recent year and reaches back as far as the data allows; a single year
 * is the given index.
 */
export function resolveYearIndexRange(
    period: Period,
    yearIndex: number,
    yearCount: number
): { startIndex: number; endIndex: number } {
    const length = getPeriodLength(period)
    if (length === undefined)
        return { startIndex: yearIndex, endIndex: yearIndex }
    const endIndex = yearCount - 1
    return { startIndex: Math.max(0, endIndex - length + 1), endIndex }
}

/** "2023", or "2019–2023" for a span of years, as a chart label */
export function formatYearRange({ start, end }: YearRange): string {
    return start === end ? String(start) : `${start}–${end}`
}

/** "in 2023", or "between 2019 and 2023", to drop into a sentence */
export function describeYearRange({ start, end }: YearRange): string {
    return start === end ? `in ${start}` : `between ${start} and ${end}`
}

/**
 * Sum every series over an inclusive range of year indices, dropping the
 * gaps. A `null` is "no trade recorded" in that year — the source only lists
 * flows that carried something — so it adds nothing, and a series that adds
 * up to no flow at all becomes no link. A single year is the range `[i, i]`.
 */
export function rowsForYearRange(
    series: TradeSeries[],
    startIndex: number,
    endIndex: number
): TradeRow[] {
    const rows: TradeRow[] = []
    for (const s of series) {
        let value = 0
        for (let i = startIndex; i <= endIndex; i++) {
            const v = s.values[i]
            if (v !== null && v !== undefined && v > 0) value += v
        }
        if (value <= 0) continue
        rows.push({ partner: s.partner, group: s.group, value })
    }
    return rows
}

/**
 * Worldwide deforestation over an inclusive range of year indices, summed
 * over every commodity group; undefined without data.
 */
export function worldTotalForYearRange(
    worldTotals: WorldGroupTotal[],
    startIndex: number,
    endIndex: number
): number | undefined {
    let total = 0
    for (const { values } of worldTotals)
        for (let i = startIndex; i <= endIndex; i++) total += values[i] ?? 0
    return total > 0 ? total : undefined
}

export function sumRows(rows: TradeRow[]): number {
    let total = 0
    for (const row of rows) total += row.value
    return total
}
