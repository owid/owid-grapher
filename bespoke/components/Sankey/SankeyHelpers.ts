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

/** How many significant nodes to show by default */
export const DEFAULT_MAX_NODES = 10
/** Most nodes we'll ever show */
export const DEFAULT_MAX_NODES_TO_SHRINK_OTHER = 10
export const STACKED_MAX_NODES_TO_SHRINK_OTHER = 10
/** Smallest share of the column total a node may have and still be drawn on its own */
export const DEFAULT_MIN_NODE_SHARE = 0.01
export const DEFAULT_MIN_LINK_SHARE = 0
export const DEFAULT_LINK_FILL_OPACITY = 0.6
export const MIN_SMALL_FLOW_FILL_OPACITY = 0.12

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

export function getSmallFlowFillOpacity({
    value,
    maxValue,
}: {
    value: number
    maxValue: number
}): number {
    if (maxValue <= 0) return DEFAULT_LINK_FILL_OPACITY
    const shareOfMax = Math.max(0, Math.min(1, value / maxValue))
    return (
        MIN_SMALL_FLOW_FILL_OPACITY +
        (DEFAULT_LINK_FILL_OPACITY - MIN_SMALL_FLOW_FILL_OPACITY) *
            Math.sqrt(shareOfMax)
    )
}

/**
 * Group flow rows by entity on the given side, sum their values, and sort
 * descending by total.
 */
export function aggregateBySide(
    flows: Flow[],
    side: LinkSide,
    entitiesToSortLast: string[] = []
): EntityTotal[] {
    return R.pipe(
        flows,
        R.groupBy((r) => r[side]),
        R.entries(),
        R.map(([entity, group]) => ({
            entity,
            total: R.sumBy(group, (r) => r.value),
        })),
        R.sortBy(
            [(d) => (entitiesToSortLast.includes(d.entity) ? 1 : 0), "asc"],
            [(d) => d.total, "desc"]
        )
    )
}
