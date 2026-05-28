import { formatValue } from "@ourworldindata/utils"
import { OwidVariableRoundingMode } from "@ourworldindata/types"

import { Flow } from "../../../components/Sankey/helpers.js"
import { TradeRow } from "./data.js"

export const formatTrade = (v: number, opts?: { short?: boolean }): string =>
    formatValue(v, {
        unit: opts?.short ? "t" : "tonnes",
        numberAbbreviation: opts?.short ? "short" : "long",
        roundingMode: OwidVariableRoundingMode.significantFigures,
        numSignificantFigures: 2,
    })

// 2 significant figures via the shared OWID formatter. Returns "" for
// non-positive values so callers can drop the parenthetical entirely.
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

export function shareAnnotation(
    share: number | undefined,
    kind: "production" | "supply"
): string | undefined {
    if (share === undefined) return undefined
    const formatted = formatShare(share)
    if (!formatted) return undefined
    return kind === "production"
        ? `${formatted} of its production`
        : `${formatted} of its domestic supply`
}

// Map raw trade rows to the neutral Flow shape used by the Sankey
// components (exporter/importer → source/target).
export function tradeToFlow(rows: TradeRow[]): Flow[] {
    return rows.map((r) => ({
        source: r.exporter,
        target: r.importer,
        value: r.value,
    }))
}
