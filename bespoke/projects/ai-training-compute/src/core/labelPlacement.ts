export interface Box {
    x: number
    y: number
    width: number
    height: number
}

export interface LabelCandidate<T> {
    item: T
    /** Positions to try, best first */
    options: Box[]
}

function overlaps(a: Box, b: Box, padding: number): boolean {
    return (
        a.x < b.x + b.width + padding &&
        b.x < a.x + a.width + padding &&
        a.y < b.y + b.height + padding &&
        b.y < a.y + a.height + padding
    )
}

function fits(box: Box, bounds: Box): boolean {
    return (
        box.x >= bounds.x &&
        box.y >= bounds.y &&
        box.x + box.width <= bounds.x + bounds.width &&
        box.y + box.height <= bounds.y + bounds.height
    )
}

/**
 * Greedy label placement: candidates are placed in order, each at its first
 * option that stays inside `bounds` and clear of `obstacles` and of every
 * label already placed. Candidates with no such option are dropped.
 */
export function placeLabels<T>(
    candidates: LabelCandidate<T>[],
    bounds: Box,
    {
        obstacles = [],
        padding = 2,
    }: { obstacles?: Box[]; padding?: number } = {}
): { item: T; box: Box; optionIndex: number }[] {
    const placed: { item: T; box: Box; optionIndex: number }[] = []
    for (const { item, options } of candidates) {
        const optionIndex = options.findIndex(
            (box) =>
                fits(box, bounds) &&
                !obstacles.some((other) => overlaps(box, other, padding)) &&
                !placed.some(({ box: other }) => overlaps(box, other, padding))
        )
        if (optionIndex !== -1)
            placed.push({ item, box: options[optionIndex], optionIndex })
    }
    return placed
}
