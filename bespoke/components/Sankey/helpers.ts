import * as R from "remeda"

import {
    formatValue as formatNumericValue,
    getRegionByName,
} from "@ourworldindata/utils"
import { OwidVariableRoundingMode } from "@ourworldindata/types"
import { LinkSide } from "./Sankey.js"
import { OwidDistinctColors, GRAY_70 } from "@ourworldindata/grapher"

export type Flow = {
    source: string
    target: string
    value: number
}

export type EntityTotal = { entity: string; total: number }

export const DEFAULT_TOP_N = 10
export const DEFAULT_MIN_NODE_SHARE = 0.01
export const DEFAULT_MIN_LINK_SHARE = 0.01

export const OTHER_KEY = "__other__"

export const NEUTRAL_COLOR = GRAY_70

const COLOR_PALETTE = [
    OwidDistinctColors.Denim,
    OwidDistinctColors.Maroon,
    OwidDistinctColors.OliveGreen,
    OwidDistinctColors.RustyOrange,
    OwidDistinctColors.Copper,
    OwidDistinctColors.Cherry,
    OwidDistinctColors.Coral,
    OwidDistinctColors.MidnightBlue,
    OwidDistinctColors.Teal,
    OwidDistinctColors.Camel,
    OwidDistinctColors.Mauve,
    OwidDistinctColors.DarkOliveGreen,
    OwidDistinctColors.Purple,
    OwidDistinctColors.DarkOrange,
    OwidDistinctColors.LightTeal,
    OwidDistinctColors.Blue,
    OwidDistinctColors.DustyCoral,
    OwidDistinctColors.DarkCopper,
    OwidDistinctColors.Peach,
    OwidDistinctColors.Turquoise,
    OwidDistinctColors.Fuchsia,
    OwidDistinctColors.TealishGreen,
    OwidDistinctColors.DarkMauve,
    OwidDistinctColors.Lime,
]

export const makeSourceId = (entity: string) => `source:${entity}`
export const makeTargetId = (entity: string) => `target:${entity}`

export function getEntityFromNodeId(id: string): string {
    if (id.startsWith("source:")) return id.slice("source:".length)
    if (id.startsWith("target:")) return id.slice("target:".length)
    throw new Error(`Unexpected node ID format: ${id}`)
}

export function getEntityShortLabel(entity: string): string {
    return getRegionByName(entity)?.shortName ?? entity
}

export function formatPercentage(v: number): string {
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
        ? `${formatValue(value)} (${formatPercentage((value / total) * 100)})`
        : formatValue(value)
}

/** Map each entity to a palette color in the given order */
export function assignColors(entities: string[]): Map<string, string> {
    return new Map(
        entities.map((entity, i) => [
            entity,
            COLOR_PALETTE[i % COLOR_PALETTE.length], // Cycle through palette if more entities than colors
        ])
    )
}

/**
 * Group flow rows by entity on the given side, sum their values, and sort
 * descending by total.
 */
export function aggregateBySide(flows: Flow[], side: LinkSide): EntityTotal[] {
    return R.pipe(
        flows,
        R.groupBy((r) => r[side]),
        R.entries(),
        R.map(([entity, group]) => ({
            entity,
            total: R.sumBy(group, (r) => r.value),
        })),
        R.sortBy([(d) => d.total, "desc"])
    )
}

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
    rows: Flow[]
    side: LinkSide
    topN: number
    minNodeShare: number
    /**
     * When the Other bucket would contain this many entries or fewer,
     * fold them back into `top` instead so the chart shows each
     * individually
     */
    showAllOtherBelow?: number
}): {
    top: EntityTotal[]
    other: EntityTotal[]
    total: number
} {
    const sortedEntities = aggregateBySide(rows, side)

    const total = R.sumBy(sortedEntities, (d) => d.total)

    const topCandidates = R.take(sortedEntities, topN)
    const topCandidatesAboveFloor = topCandidates.filter(
        (d) => total > 0 && d.total / total >= minNodeShare
    )
    let top =
        topCandidatesAboveFloor.length > 0
            ? topCandidatesAboveFloor
            : R.take(topCandidates, 1)
    let other = R.drop(sortedEntities, top.length)

    // Inline a small Other tail
    if (other.length > 0 && other.length <= showAllOtherBelow) {
        top = [...top, ...other]
        other = []
    }

    return { top, other, total }
}
