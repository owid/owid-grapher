import { FLOAT_TOLERANCE_PX } from "./AnchoredLabelsConstants.js"

export interface EdgeLabelToPlace {
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

/**
 * Center y of every label, in anchor order and at least gap apart, each as
 * close to its anchor as that allows. The labels are then shifted into range;
 * if they are taller than the range, they start at the range's top.
 */
export function separateLabelsNearAnchors(
    labels: readonly EdgeLabelToPlace[],
    range: VerticalRange,
    gap: number
): CenterYByLabelId {
    const positions: CenterYByLabelId = new Map()
    if (labels.length === 0) return positions

    const sorted = labels.toSorted((a, b) => a.anchorY - b.anchorY)

    // Center of each label relative to the first one's when all sit exactly
    // gap apart, e.g. [0, 12, 24] for 10px labels and a gap of 2
    const offsetsFromFirstCenter: number[] = [0]
    for (let i = 1; i < sorted.length; i++) {
        offsetsFromFirstCenter.push(
            offsetsFromFirstCenter[i - 1] +
                sorted[i - 1].height / 2 +
                gap +
                sorted[i].height / 2
        )
    }

    // A label's start is the first label's center that puts it on its
    // anchor: anchorY - offset. Labels don't overlap when starts never
    // decrease from top to bottom, so blocks of labels exactly gap apart are merged
    // (pool adjacent violators) until their mean starts are in order. E.g.
    // anchors 50, 52 and 80 want starts 50, 40 and 56; the first two merge at
    // 45, giving centers 45, 57 and 80.
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

    // Starts that put the first label's top on range.top and the last
    // label's bottom on range.bottom; labels taller than the range start at
    // the top
    const minStartY = range.top + sorted[0].height / 2
    const maxStartY = Math.max(
        minStartY,
        range.bottom -
            sorted[sorted.length - 1].height / 2 -
            offsetsFromFirstCenter[sorted.length - 1]
    )

    // Blocks cover sorted in order; each label's center is its block's
    // clamped start plus its offset
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

/**
 * Center y of each label kept. Labels are added in priority order and all
 * kept labels separated again each time; a label is skipped if they would
 * no longer fit the range or any label would end up more than maxShift from
 * its anchor. Skipped labels are missing from the result.
 */
export function placeEdgeLabels(
    labelsByPriority: readonly EdgeLabelToPlace[],
    {
        range,
        gap,
        maxShift,
    }: { range: VerticalRange; gap: number; maxShift: number }
): CenterYByLabelId {
    let kept: EdgeLabelToPlace[] = []
    let centerYs: CenterYByLabelId = new Map()
    // n labels take n * height + (n - 1) * gap; each label is charged
    // height + gap, so the budget gets one extra gap
    let remainingHeight = range.bottom - range.top + gap

    for (const label of labelsByPriority) {
        const cost = label.height + gap
        if (cost > remainingHeight) continue

        // Checks every label, since adding one can push kept labels too far
        const candidate = [...kept, label]
        const candidateCenterYs = separateLabelsNearAnchors(
            candidate,
            range,
            gap
        )
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
