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
export const DEFAULT_MAX_NODES_TO_SHRINK_OTHER = 15
/** Smallest share of the column total a node may have and still be drawn on its own */
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
 * Choose which entities on a given side to show as their own Sankey node;
 * everything else is folded into an "Other" bucket.
 *
 *  1. Significance floor — show every entity individually big enough to read as
 *     its own node (≥ `minNodeShare` of the column total), largest-first, up to
 *     `maxNodes`.
 *  2. "Other"-is-smallest — a reader shouldn't see the aggregated "Other"
 *     bucket outweigh an individually named partner. While it does, promote the
 *     largest remaining entity out of "Other".
 */
export function selectTopEntities({
    flows,
    side,
    maxNodes,
    maxNodesToShrinkOther = maxNodes,
    minNodeShare,
    showAllOtherBelow = 0,
}: {
    flows: Flow[]
    side: LinkSide
    maxNodes: number
    maxNodesToShrinkOther?: number
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
    const sortedEntities = aggregateBySide(flows, side)
    const total = R.sumBy(sortedEntities, (d) => d.total)

    if (sortedEntities.length === 0 || total <= 0) {
        return { top: sortedEntities, other: [], total }
    }

    // The most nodes we'd ever draw
    const ceiling = Math.max(maxNodes, maxNodesToShrinkOther)

    // Show all if there are few enough
    if (sortedEntities.length <= ceiling) {
        return { top: sortedEntities, other: [], total }
    }

    const floor = minNodeShare * total

    // 1. Significance floor: the leading run of entities at or above the floor,
    //    but always ≥ 1 and never more than the default node budget
    const significant = R.takeWhile(
        sortedEntities,
        (d) => d.total >= floor
    ).length
    const baseCount = R.clamp(significant, { min: 1, max: maxNodes })

    // 2. "Other"-is-smallest: Promote entities out of "Other" while it both
    //    outweighs the smallest shown node and is itself above the floor,
    //    climbing up to the ceiling
    const otherTotalFrom = (k: number): number =>
        total - R.sumBy(R.take(sortedEntities, k), (d) => d.total)
    const promotions = R.takeWhile(R.range(baseCount, ceiling), (k) => {
        const otherTotal = otherTotalFrom(k)
        return otherTotal > sortedEntities[k - 1].total && otherTotal >= floor
    }).length

    const count = baseCount + promotions

    let top = R.take(sortedEntities, count)
    let other = R.drop(sortedEntities, count)

    // Inline a small Other tail
    if (other.length > 0 && other.length <= showAllOtherBelow) {
        top = [...top, ...other]
        other = []
    }

    return { top, other, total }
}
