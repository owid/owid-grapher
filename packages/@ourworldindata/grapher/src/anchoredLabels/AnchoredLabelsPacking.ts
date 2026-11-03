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
