import * as R from "remeda"

import {
    formatValue as formatNumericValue,
    getRegionByName,
} from "@ourworldindata/utils"
import {
    ColorSchemeName,
    OwidVariableRoundingMode,
} from "@ourworldindata/types"
import { ColorSchemes } from "@ourworldindata/grapher/src/color/ColorSchemes.js"

export const DEFAULT_TOP_N = 10
export const DEFAULT_MIN_NODE_SHARE = 0.01
export const DEFAULT_MIN_LINK_SHARE = 0.01

export const NEUTRAL_COLOR = "#767676"
// Sentinel key in the color map so the "Other" bucket gets a stable palette
// color, shared across the two halves of a flow visualization.
export const OTHER_KEY = "__other__"

// Owid-distinct swaps its underlying palette depending on how many colors are
// requested: the 12-color palette (Denim first) is used for N ≤ 12 and the
// 24-color palette (Purple first) for N > 12. We always pull from the
// 24-color palette so that color[0] (the rank-1 entity) stays the same as
// the entity count changes between countries / filters.
const OWID_DISTINCT = ColorSchemes.get(ColorSchemeName["owid-distinct"])
const PALETTE = OWID_DISTINCT.getColors(12)

export type FlowRow = {
    source: string
    target: string
    value: number
}

export const makeSourceId = (entity: string) => `source:${entity}`
export const makeTargetId = (entity: string) => `target:${entity}`

export function entityFromId(id: string): string {
    if (id.startsWith("source:")) return id.slice("source:".length)
    if (id.startsWith("target:")) return id.slice("target:".length)
    throw new Error(`Unexpected node ID format: ${id}`)
}

// In-chart label for an entity. Uses the OWID short name when available
// (e.g. "United States" → "USA", "Russian Federation" → "Russia") so the
// label column doesn't crowd the chart. Falls back to the full name for
// entities that aren't in the regions table (e.g. the "Other" bucket
// sentinel, or non-region names like product groupings).
export function entityShortLabel(entity: string): string {
    return getRegionByName(entity)?.shortName ?? entity
}

// 2 significant figures via the shared OWID formatter. Input is a
// percentage (e.g. 12.3 → "12%"). Sub-10% values keep their precision
// (e.g. 0.34 → "0.34%") instead of collapsing to "0%".
export function formatPct(v: number): string {
    if (!isFinite(v) || v <= 0) return "0%"
    return formatNumericValue(v, {
        unit: "%",
        numberAbbreviation: false,
        roundingMode: OwidVariableRoundingMode.significantFigures,
        numSignificantFigures: 2,
    })
}

export function makeValueLabel({
    value,
    total,
    formatValue,
}: {
    value: number
    total: number
    formatValue: (v: number) => string
}): string {
    return total > 0
        ? `${formatValue(value)} (${formatPct((value / total) * 100)})`
        : formatValue(value)
}

/** Map each entity to a palette color in the given order. */
export function assignColors(entities: string[]): Map<string, string> {
    return new Map(
        entities.map((entity, i) => [entity, PALETTE[i] ?? NEUTRAL_COLOR])
    )
}

export type EntityTotal = { entity: string; total: number }

/**
 * Aggregate flow rows by side (collapsing multiple rows into one per-entity
 * total), then pick the top N. An entity that made the top N gets demoted
 * into the "Other" bucket if its share of the column total is below
 * minNodeShare.
 */
export function selectTopEntities({
    rows,
    side,
    topN,
    minNodeShare,
    showAllOtherBelow = 0,
}: {
    rows: FlowRow[]
    side: "source" | "target"
    topN: number
    minNodeShare: number
    /** When the Other bucket would contain this many entries or fewer,
     *  fold them back into `top` instead so the chart shows each
     *  individually. The Other bucket exists for visual compression, so
     *  it isn't useful for just one or two tiny entities — they fit fine.
     *  Defaults to 0 (never fold). */
    showAllOtherBelow?: number
}): {
    top: EntityTotal[]
    /** Entities folded into the "Other" bucket, sorted descending by total.
     *  Consumers (e.g. an Other tooltip) can break this back out to show
     *  what's hidden inside the bucket. Empty when no entities were demoted. */
    other: EntityTotal[]
    otherTotal: number
    grandTotal: number
} {
    // Aggregate flow values by entity on the specified side, sorted descending
    const sortedEntities: EntityTotal[] = R.pipe(
        rows,
        R.groupBy((row) => row[side]),
        R.mapValues((group) => R.sumBy(group, (r) => r.value)),
        Object.entries,
        R.map(([entity, total]) => ({ entity, total })),
        R.sortBy([(d) => d.total, "desc"])
    )

    const grandTotal = R.sumBy(sortedEntities, (d) => d.total)

    const topCandidates = R.take(sortedEntities, topN)
    const topCandidatesAboveFloor = topCandidates.filter(
        (d) => grandTotal > 0 && d.total / grandTotal >= minNodeShare
    )
    let top =
        topCandidatesAboveFloor.length > 0
            ? topCandidatesAboveFloor
            : R.take(topCandidates, 1)
    let other = R.drop(sortedEntities, top.length)

    // Inline a small Other tail: a single-entity "Other" reads as an
    // unnecessary bucket; two entities still don't earn the visual
    // compression that bucketing provides. Above the threshold, keep
    // the bucket so the chart stays legible.
    if (other.length > 0 && other.length <= showAllOtherBelow) {
        top = [...top, ...other]
        other = []
    }

    const otherTotal = R.sumBy(other, (d) => d.total)

    return { top, other, otherTotal, grandTotal }
}
