import { Bounds } from "@ourworldindata/utils"
import { FLOAT_TOLERANCE_PX, SHIFT_STEP_PX } from "./AnchoredLabelsConstants.js"
import { VerticalRange } from "./AnchoredLabelsEdgePlacement.js"

export interface InChartLabelToPlace {
    id: string
    /** Label bounds, kept inside the range */
    bounds: Bounds
    /** Padded label bounds, kept clear of the bounds to avoid and earlier labels */
    collisionBounds: Bounds
    /** Fixed bounds the label must not cover */
    boundsToAvoid: readonly Bounds[]
}

type OffsetYByLabelId = Map<string, number>

/**
 * Y offset of each label kept. Labels are placed in priority order, each at
 * the smallest y offset within maxShift that keeps it inside the range and
 * clear of its bounds to avoid and the labels placed before it. Labels
 * without such a y offset are missing from the result.
 */
export function placeInChartLabels(
    labelsByPriority: readonly InChartLabelToPlace[],
    { range, maxShift }: { range: VerticalRange; maxShift: number }
): OffsetYByLabelId {
    const offsetYs: OffsetYByLabelId = new Map()
    const placedCollisionBounds: Bounds[] = []
    const candidateOffsetYs = getCandidateOffsetYs(maxShift)

    for (const label of labelsByPriority) {
        const boundsInReach = findBoundsToAvoidInReach({
            collisionBounds: label.collisionBounds,
            maxShift,
            boundsToAvoid: [...placedCollisionBounds, ...label.boundsToAvoid],
        })
        const offsetY = candidateOffsetYs.find((offsetY) =>
            canPlaceAtOffsetY({ label, offsetY, range, boundsInReach })
        )
        if (offsetY === undefined) continue

        offsetYs.set(label.id, offsetY)
        placedCollisionBounds.push(
            label.collisionBounds.set({ y: label.collisionBounds.y + offsetY })
        )
    }

    return offsetYs
}

/**
 * Bounds to avoid that the label could hit anywhere in its shift range. This
 * is the only horizontal check; canPlaceAtOffsetY tests vertical overlap alone.
 */
function findBoundsToAvoidInReach({
    collisionBounds,
    maxShift,
    boundsToAvoid,
}: {
    collisionBounds: Bounds
    maxShift: number
    boundsToAvoid: readonly Bounds[]
}): Bounds[] {
    const reach = maxShift + SHIFT_STEP_PX
    const reachBounds = collisionBounds.expand({ top: reach, bottom: reach })
    return boundsToAvoid.filter((toAvoid) => reachBounds.intersects(toAvoid))
}

/** Whether the label, shifted by offsetY, stays inside the range and clear of boundsInReach */
function canPlaceAtOffsetY({
    label,
    offsetY,
    range,
    boundsInReach,
}: {
    label: InChartLabelToPlace
    offsetY: number
    range: VerticalRange
    boundsInReach: readonly Bounds[]
}): boolean {
    if (label.bounds.top + offsetY < range.top) return false
    if (label.bounds.bottom + offsetY > range.bottom) return false
    const shifted = label.collisionBounds.set({
        y: label.collisionBounds.y + offsetY,
    })
    return !boundsInReach.some((toAvoid) => shifted.hasVerticalOverlap(toAvoid))
}

/** Y offsets within maxShift in SHIFT_STEP_PX steps, nearest first, up before down */
function getCandidateOffsetYs(maxShift: number): number[] {
    const offsetYs = [0]
    for (let k = 1; k * SHIFT_STEP_PX <= maxShift + FLOAT_TOLERANCE_PX; k++)
        offsetYs.push(-k * SHIFT_STEP_PX, k * SHIFT_STEP_PX)
    return offsetYs
}
