import * as _ from "lodash-es"
import { FLOAT_TOLERANCE_PX } from "./AnchoredLabelsConstants.js"

export interface ColumnLabel {
    id: string
    anchorY: number
    height: number
}

export interface VerticalRange {
    top: number
    bottom: number
}

type CenterYByLabelId = Map<string, number>

interface Block {
    sum: number
    count: number
}

export function packColumn(
    labels: readonly ColumnLabel[],
    range: VerticalRange,
    gap: number
): CenterYByLabelId {
    const positions: CenterYByLabelId = new Map()
    if (labels.length === 0) return positions

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
            sum: label.anchorY - offsetsFromFirstCenter[i],
            count: 1,
        })
        while (blocks.length > 1) {
            const last = blocks[blocks.length - 1]
            const previous = blocks[blocks.length - 2]
            if (previous.sum / previous.count <= last.sum / last.count) break
            blocks.splice(-2, 2, {
                sum: previous.sum + last.sum,
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
            Math.max(block.sum / block.count, minStartY),
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

/** Center y of each label kept in the column; labels that don't fit or would move more than maxShift are absent */
export function placeColumn(
    labelsByPriority: readonly ColumnLabel[],
    {
        range,
        gap,
        maxShift,
    }: { range: VerticalRange; gap: number; maxShift: number }
): CenterYByLabelId {
    const availableHeight = range.bottom - range.top
    let kept = keepLabelsThatFit({ labelsByPriority, availableHeight, gap })
    let centerYs = packColumn(kept, range, gap)

    const maxDrops = kept.length
    for (let drops = 0; drops < maxDrops; drops++) {
        const mostShifted = findMostShiftedLabelBeyondMaxShift({
            labels: kept,
            centerYs,
            maxShift,
        })
        if (!mostShifted) break
        const crowdedBlock = findBlockContaining({
            labels: kept,
            centerYs,
            target: mostShifted,
            gap,
        })
        const labelToDrop = _.findLast(kept, (label) =>
            crowdedBlock.includes(label)
        )!
        kept = kept.filter((label) => label !== labelToDrop)
        centerYs = packColumn(kept, range, gap)
    }

    // A label left out may fit once drops have made room
    for (const label of labelsByPriority) {
        if (kept.includes(label)) continue
        const candidate = labelsByPriority.filter(
            (other) => other === label || kept.includes(other)
        )
        const fitsInRange =
            keepLabelsThatFit({
                labelsByPriority: candidate,
                availableHeight,
                gap,
            }).length === candidate.length
        if (!fitsInRange) continue
        const candidateCenterYs = packColumn(candidate, range, gap)
        if (
            findMostShiftedLabelBeyondMaxShift({
                labels: candidate,
                centerYs: candidateCenterYs,
                maxShift,
            })
        )
            continue
        kept = candidate
        centerYs = candidateCenterYs
    }

    return centerYs
}

function keepLabelsThatFit({
    labelsByPriority,
    availableHeight,
    gap,
}: {
    labelsByPriority: readonly ColumnLabel[]
    availableHeight: number
    gap: number
}): ColumnLabel[] {
    // Each label pays for one gap, so the budget includes one the last label doesn't need
    let remainingBudget = availableHeight + gap
    return labelsByPriority.filter((label) => {
        const cost = label.height + gap
        if (cost > remainingBudget) return false
        remainingBudget -= cost
        return true
    })
}

function findMostShiftedLabelBeyondMaxShift({
    labels,
    centerYs,
    maxShift,
}: {
    labels: readonly ColumnLabel[]
    centerYs: CenterYByLabelId
    maxShift: number
}): ColumnLabel | undefined {
    const shiftOf = (label: ColumnLabel): number =>
        Math.abs(centerYs.get(label.id)! - label.anchorY)
    const mostShifted = _.maxBy(labels, shiftOf)
    return mostShifted && shiftOf(mostShifted) > maxShift + FLOAT_TOLERANCE_PX
        ? mostShifted
        : undefined
}

function findBlockContaining({
    labels,
    centerYs,
    target,
    gap,
}: {
    labels: readonly ColumnLabel[]
    centerYs: CenterYByLabelId
    target: ColumnLabel
    gap: number
}): ColumnLabel[] {
    const sorted = _.sortBy(labels, (label) => centerYs.get(label.id)!)
    const isTouching = (above: ColumnLabel, below: ColumnLabel): boolean =>
        centerYs.get(below.id)! -
            below.height / 2 -
            (centerYs.get(above.id)! + above.height / 2) <=
        gap + FLOAT_TOLERANCE_PX

    const targetIndex = sorted.indexOf(target)
    let start = targetIndex
    while (start > 0 && isTouching(sorted[start - 1], sorted[start])) start--
    let end = targetIndex
    while (end < sorted.length - 1 && isTouching(sorted[end], sorted[end + 1]))
        end++
    return sorted.slice(start, end + 1)
}
