export interface LineLabelItem {
    id: string
    /** Preferred vertical center of the label (usually the y position of the
     * line's last point) */
    idealY: number
    /** Height of the (possibly multi-line) label */
    height: number
}

/** Resolve collisions between the labels placed at the right edge of a line
 * chart. Labels keep their vertical order, are pushed apart so they don't
 * overlap (with `gap` pixels between them), and are kept within
 * [top, bottom]. Returns the adjusted vertical center per label id. */
export function placeLineLabels(
    items: LineLabelItem[],
    { gap = 4, top, bottom }: { gap?: number; top: number; bottom: number }
): Map<string, number> {
    const sorted = [...items].sort((a, b) => a.idealY - b.idealY)
    const positions = sorted.map((item) => item.idealY)

    const minCenterDistance = (i: number, j: number): number =>
        (sorted[i].height + sorted[j].height) / 2 + gap

    // Push labels down so they don't overlap the one above
    for (let i = 1; i < positions.length; i++) {
        positions[i] = Math.max(
            positions[i],
            positions[i - 1] + minCenterDistance(i - 1, i)
        )
    }

    // Pull labels back up if they overflow the bottom
    const last = positions.length - 1
    if (last >= 0) {
        positions[last] = Math.min(
            positions[last],
            bottom - sorted[last].height / 2
        )
        for (let i = last - 1; i >= 0; i--) {
            positions[i] = Math.min(
                positions[i],
                positions[i + 1] - minCenterDistance(i, i + 1)
            )
        }
    }

    // Clamp to the top; if there is not enough room for all labels, the
    // bottom ones may overflow, which is acceptable for our small label
    // counts
    for (let i = 0; i < positions.length; i++) {
        const minY =
            i === 0
                ? top + sorted[0].height / 2
                : positions[i - 1] + minCenterDistance(i - 1, i)
        positions[i] = Math.max(positions[i], minY)
    }

    return new Map(sorted.map((item, i) => [item.id, positions[i]]))
}
