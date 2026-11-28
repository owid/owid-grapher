/**
 * Spreads labels along one axis so none sit closer than `minGap`, moving each
 * as little as possible from where it wants to be. Input order doesn't
 * matter; output is in input order.
 *
 * Works by sorting, then merging overlapping runs into blocks centered on the
 * mean of their desired positions (the classic 1-D label placement pass),
 * then clamping the whole stack into [min, max].
 */
export function spreadLabels(
    desired: number[],
    minGap: number,
    bounds: { min: number; max: number }
): number[] {
    if (desired.length === 0) return []

    const order = desired
        .map((value, index) => ({ value, index }))
        .sort((a, b) => a.value - b.value)

    type Block = { start: number; members: number[]; desiredSum: number }
    const blocks: Block[] = []

    for (const { value, index } of order) {
        blocks.push({ start: value, members: [index], desiredSum: value })
        // Merge backwards while the newest block overlaps the previous one
        while (blocks.length > 1) {
            const last = blocks[blocks.length - 1]
            const prev = blocks[blocks.length - 2]
            const prevEnd = prev.start + (prev.members.length - 1) * minGap
            if (last.start - prevEnd >= minGap) break
            const members = [...prev.members, ...last.members]
            const desiredSum = prev.desiredSum + last.desiredSum
            const center = desiredSum / members.length
            blocks.splice(blocks.length - 2, 2, {
                members,
                desiredSum,
                start: center - ((members.length - 1) * minGap) / 2,
            })
        }
    }

    const result = new Array<number>(desired.length)
    for (const block of blocks)
        block.members.forEach((member, i) => {
            result[member] = block.start + i * minGap
        })

    // Shift the whole stack back inside the bounds if it spilled over
    const lowest = Math.min(...result)
    const highest = Math.max(...result)
    const shift =
        lowest < bounds.min
            ? bounds.min - lowest
            : highest > bounds.max
              ? bounds.max - highest
              : 0
    return result.map((value) => value + shift)
}
