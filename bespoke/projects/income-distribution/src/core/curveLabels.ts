/** An axis-aligned box in pixel space */
export interface LabelBox {
    left: number
    right: number
    top: number
    bottom: number
}

/** A curve to label, in pixel space */
export interface CurveLabelCandidate {
    key: string
    /** The label's width in px */
    width: number
    /** The curve's top edge, one point per grid column, left to right */
    points: { x: number; y: number }[]
}

export interface CurveLabel {
    key: string
    /** Horizontal centre of the label */
    x: number
    /** Bottom edge of the label's box, i.e. roughly its baseline */
    y: number
    box: LabelBox
}

export interface CurveLabelLayout {
    labels: CurveLabel[]
    /** Keys of the curves no label could be placed for, in input order */
    dropped: string[]
}

export interface CurveLabelOptions {
    /**
     * Where labels may go. `bottom` is the curves' baseline: it bounds how
     * far down the curve a label may move (see `minHeightShare`)
     */
    bounds: LabelBox
    /** Height of a label's box in px */
    labelHeight: number
    /** Gap between a label and the curve below it, default 4 */
    curvePadding?: number
    /** Gap kept between two labels, default 2 */
    labelPadding?: number
    /**
     * A label moved away from its peak stays where the curve is at least
     * this share of its peak's height above the baseline, so it still reads
     * as belonging to its own curve; default 0.5
     */
    minHeightShare?: number
    /** Boxes labels mustn't cover, e.g. a button over the plot */
    obstacles?: LabelBox[]
}

/**
 * Places each curve's label just above it, without two labels (or a label
 * and an obstacle) overlapping. Curves are handled tallest peak first, and
 * each label tries, in order:
 *
 * 1. above the curve's peak;
 * 2. above the highest other stretch of the curve where it fits, among the
 *    spots where the curve is at least `minHeightShare` of its peak's height;
 * 3. above the peak, stacked on top of the labels in the way.
 *
 * A label always sits above the curve along its whole width, and is shifted
 * horizontally to stay inside `bounds`. Labels that fit nowhere are dropped.
 */
export function placeCurveLabels(
    candidates: CurveLabelCandidate[],
    options: CurveLabelOptions
): CurveLabelLayout {
    const { bounds, labelHeight } = options
    const curvePadding = options.curvePadding ?? 4
    const labelPadding = options.labelPadding ?? 2
    const minHeightShare = options.minHeightShare ?? 0.5

    const occupied: LabelBox[] = [...(options.obstacles ?? [])]
    const placed = new Map<string, CurveLabel>()

    // Tallest peak first (smallest y); ties keep input order
    const ordered = candidates
        .map((candidate, index) => ({
            candidate,
            index,
            peak: peakIndex(candidate.points),
        }))
        .filter(({ peak }) => peak !== undefined)
        .sort(
            (a, b) =>
                a.candidate.points[a.peak!].y - b.candidate.points[b.peak!].y ||
                a.index - b.index
        )

    for (const { candidate, peak } of ordered) {
        const { points, width } = candidate
        if (width > bounds.right - bounds.left) continue

        /** The label centred at `x` (clamped into bounds), resting on the curve */
        const boxAt = (x: number): LabelBox => {
            const centre = clampCentre(x, width, bounds)
            const left = centre - width / 2
            const right = centre + width / 2
            const bottom = highestCurveY(points, left, right) - curvePadding
            return { left, right, top: bottom - labelHeight, bottom }
        }
        const fits = (box: LabelBox): boolean =>
            box.top >= bounds.top &&
            !occupied.some((other) => overlaps(box, other, labelPadding))

        const peakPoint = points[peak!]
        let box: LabelBox | undefined = boxAt(peakPoint.x)

        // 2. Along the curve, highest stretch first
        if (!fits(box)) {
            const minY =
                bounds.bottom - (bounds.bottom - peakPoint.y) * minHeightShare
            box = points
                .map((point, i) => ({ point, i }))
                .filter(({ point }) => point.y <= minY)
                .sort((a, b) => a.point.y - b.point.y || a.i - b.i)
                .map(({ point }) => boxAt(point.x))
                .find(fits)
        }

        // 3. Stacked above whatever is in the way at the peak
        if (!box) box = stackAbove(boxAt(peakPoint.x), occupied, labelPadding)
        if (!box || !fits(box)) continue

        occupied.push(box)
        placed.set(candidate.key, {
            key: candidate.key,
            x: (box.left + box.right) / 2,
            y: box.bottom,
            box,
        })
    }

    return {
        labels: candidates.flatMap((c) => placed.get(c.key) ?? []),
        dropped: candidates.filter((c) => !placed.has(c.key)).map((c) => c.key),
    }
}

function peakIndex(points: { y: number }[]): number | undefined {
    let best: number | undefined
    points.forEach((point, i) => {
        if (best === undefined || point.y < points[best].y) best = i
    })
    return best
}

function clampCentre(x: number, width: number, bounds: LabelBox): number {
    const min = bounds.left + width / 2
    const max = bounds.right - width / 2
    return Math.min(Math.max(x, min), max)
}

/**
 * The smallest y (highest point) of the curve between `left` and `right`,
 * including its interpolated values at both ends
 */
function highestCurveY(
    points: { x: number; y: number }[],
    left: number,
    right: number
): number {
    let minY = Math.min(interpolateY(points, left), interpolateY(points, right))
    for (const point of points)
        if (point.x >= left && point.x <= right) minY = Math.min(minY, point.y)
    return minY
}

function interpolateY(points: { x: number; y: number }[], x: number): number {
    if (x <= points[0].x) return points[0].y
    for (let i = 1; i < points.length; i++) {
        const a = points[i - 1]
        const b = points[i]
        if (x <= b.x)
            return b.x === a.x
                ? Math.min(a.y, b.y)
                : a.y + ((x - a.x) / (b.x - a.x)) * (b.y - a.y)
    }
    return points[points.length - 1].y
}

/** Moves `box` up until it clears every box in `occupied` */
function stackAbove(
    box: LabelBox,
    occupied: LabelBox[],
    padding: number
): LabelBox {
    let current = box
    for (;;) {
        const blocking = occupied.filter((other) =>
            overlaps(current, other, padding)
        )
        if (blocking.length === 0) return current
        const bottom = Math.min(...blocking.map((other) => other.top)) - padding
        current = {
            ...current,
            top: bottom - (current.bottom - current.top),
            bottom,
        }
    }
}

function overlaps(a: LabelBox, b: LabelBox, padding: number): boolean {
    return (
        a.left < b.right + padding &&
        b.left < a.right + padding &&
        a.top < b.bottom + padding &&
        b.top < a.bottom + padding
    )
}
