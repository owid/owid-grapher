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

/** Center y of each label kept in the column; labels join in priority order while the column fits and none moves more than maxShift */
export function placeColumn(
    labelsByPriority: readonly ColumnLabel[],
    {
        range,
        gap,
        maxShift,
    }: { range: VerticalRange; gap: number; maxShift: number }
): CenterYByLabelId {
    let kept: ColumnLabel[] = []
    let centerYs: CenterYByLabelId = new Map()
    // Each label pays for one gap, so the budget includes one the last label doesn't need
    let remainingHeight = range.bottom - range.top + gap

    for (const label of labelsByPriority) {
        const cost = label.height + gap
        if (cost > remainingHeight) continue

        const candidate = [...kept, label]
        const candidateCenterYs = packColumn(candidate, range, gap)
        const isWithinMaxShift = candidate.every(
            (other) =>
                Math.abs(candidateCenterYs.get(other.id)! - other.anchorY) <=
                maxShift + FLOAT_TOLERANCE_PX
        )
        if (!isWithinMaxShift) continue

        kept = candidate
        centerYs = candidateCenterYs
        remainingHeight -= cost
    }
    return centerYs
}
