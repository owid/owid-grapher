import * as _ from "lodash-es"

export interface ColumnLabel {
    id: string
    anchorY: number
    height: number
    weight: number
}

export interface VerticalRange {
    top: number
    bottom: number
}

export type CenterYByLabelId = Map<string, number>

interface Block {
    weightedSum: number
    weight: number
    count: number
}

export function packColumn(
    labels: readonly ColumnLabel[],
    range: VerticalRange,
    gap: number
): CenterYByLabelId {
    const positions: CenterYByLabelId = new Map()
    if (labels.length === 0) return positions

    // Array.prototype.sort is stable, so equal anchors keep their input order
    const sorted = [...labels].sort((a, b) => a.anchorY - b.anchorY)

    const offsetsFromFirstCenter: number[] = [0]
    for (let i = 1; i < sorted.length; i++) {
        offsetsFromFirstCenter.push(
            offsetsFromFirstCenter[i - 1] +
                sorted[i - 1].height / 2 +
                gap +
                sorted[i].height / 2
        )
    }

    const blocks: Block[] = []
    for (const [i, label] of sorted.entries()) {
        blocks.push({
            weightedSum:
                (label.anchorY - offsetsFromFirstCenter[i]) * label.weight,
            weight: label.weight,
            count: 1,
        })
        while (blocks.length > 1) {
            const last = blocks[blocks.length - 1]
            const previous = blocks[blocks.length - 2]
            if (
                previous.weightedSum / previous.weight <=
                last.weightedSum / last.weight
            )
                break
            blocks.splice(-2, 2, {
                weightedSum: previous.weightedSum + last.weightedSum,
                weight: previous.weight + last.weight,
                count: previous.count + last.count,
            })
        }
    }

    const minStartY = range.top + sorted[0].height / 2
    const maxStartY = Math.max(
        minStartY,
        range.bottom -
            sorted[sorted.length - 1].height / 2 -
            offsetsFromFirstCenter[sorted.length - 1]
    )

    let index = 0
    for (const block of blocks) {
        const start = Math.min(
            Math.max(block.weightedSum / block.weight, minStartY),
            maxStartY
        )
        for (let k = 0; k < block.count; k++, index++) {
            positions.set(
                sorted[index].id,
                start + offsetsFromFirstCenter[index]
            )
        }
    }
    return positions
}

export type ColumnPlacement =
    | { kind: "placed"; y: number }
    | { kind: "hidden"; reason: "budget" | "too-far" }

const TOLERANCE_PX = 0.01

export function placeColumn(
    labelsByPriority: readonly ColumnLabel[],
    {
        range,
        gap,
        maxShift,
    }: { range: VerticalRange; gap: number; maxShift: number }
): Map<string, ColumnPlacement> {
    let kept = fitHeightBudget(labelsByPriority, range.bottom - range.top, gap)
    let centerYs = packColumn(kept, range, gap)
    const tooFarIds = new Set<string>()

    for (;;) {
        const worst = findWorstViolator(kept, centerYs, maxShift)
        if (!worst) break
        const group = findTouchingGroup(kept, centerYs, worst, gap)
        const victim = _.findLast(kept, (label) => group.includes(label))!
        tooFarIds.add(victim.id)
        kept = kept.filter((label) => label !== victim)
        centerYs = packColumn(kept, range, gap)
    }

    const placements = new Map<string, ColumnPlacement>()
    for (const label of labelsByPriority) {
        const y = centerYs.get(label.id)
        placements.set(
            label.id,
            y !== undefined
                ? { kind: "placed", y }
                : {
                      kind: "hidden",
                      reason: tooFarIds.has(label.id) ? "too-far" : "budget",
                  }
        )
    }
    return placements
}

function fitHeightBudget(
    labelsByPriority: readonly ColumnLabel[],
    availableHeight: number,
    gap: number
): ColumnLabel[] {
    const kept: ColumnLabel[] = []
    let usedHeight = 0
    for (const label of labelsByPriority) {
        const nextHeight = usedHeight + label.height + (kept.length ? gap : 0)
        if (nextHeight <= availableHeight) {
            kept.push(label)
            usedHeight = nextHeight
        }
    }
    return kept
}

function findWorstViolator(
    labels: readonly ColumnLabel[],
    centerYs: CenterYByLabelId,
    maxShift: number
): ColumnLabel | undefined {
    const shiftOf = (label: ColumnLabel): number =>
        Math.abs(centerYs.get(label.id)! - label.anchorY)
    const worst = _.maxBy(labels, shiftOf)
    return worst && shiftOf(worst) > maxShift + TOLERANCE_PX ? worst : undefined
}

function findTouchingGroup(
    labels: readonly ColumnLabel[],
    centerYs: CenterYByLabelId,
    target: ColumnLabel,
    gap: number
): ColumnLabel[] {
    const sorted = _.sortBy(labels, (label) => centerYs.get(label.id)!)
    const isTouching = (above: ColumnLabel, below: ColumnLabel): boolean =>
        centerYs.get(below.id)! -
            below.height / 2 -
            (centerYs.get(above.id)! + above.height / 2) <=
        gap + TOLERANCE_PX

    const targetIndex = sorted.indexOf(target)
    let start = targetIndex
    while (start > 0 && isTouching(sorted[start - 1], sorted[start])) start--
    let end = targetIndex
    while (end < sorted.length - 1 && isTouching(sorted[end], sorted[end + 1]))
        end++
    return sorted.slice(start, end + 1)
}
