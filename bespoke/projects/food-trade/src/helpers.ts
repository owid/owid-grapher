import { formatValue } from "@ourworldindata/utils"
import { OwidVariableRoundingMode } from "@ourworldindata/types"

import { Flow } from "../../../components/Sankey/SankeyHelpers.js"
import { TradeRow } from "./types.js"

export const ALL_COUNTRIES = "All countries"

export const isAllCountry = (c: string): boolean => c === ALL_COUNTRIES

export const formatTrade = (v: number, opts?: { short?: boolean }): string => {
    // If it's less than one ton, show it in kg instead
    if (v <= 1)
        return formatValue(v * 1000, {
            unit: opts?.short ? "kg" : "kilograms",
            numberAbbreviation: opts?.short ? "short" : "long",
            roundingMode: OwidVariableRoundingMode.significantFigures,
            numSignificantFigures: 2,
        })

    return formatValue(v, {
        unit: opts?.short ? "t" : "tonnes",
        numberAbbreviation: opts?.short ? "short" : "long",
        roundingMode: OwidVariableRoundingMode.significantFigures,
        numSignificantFigures: 2,
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

export function tradesToFlows(rows: TradeRow[]): Flow[] {
    return rows.map((r) => ({
        source: r.exporter,
        target: r.importer,
        value: r.value,
    }))
}

/** Cap a list to 8 visible items, returning the remainder count */
export function capItems<T>(items: T[]): { visible: T[]; hiddenCount: number } {
    const showAll = items.length <= 10
    const visible = showAll ? items : items.slice(0, 8)
    return { visible, hiddenCount: items.length - visible.length }
}
