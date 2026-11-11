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
     * How far a label may move from its peak, in multiples of its own
     * width; default 1.5
     */
    maxShift?: number
    /**
     * A label moved away from its peak stays where the curve is at least
     * this share of its peak's height above the baseline, so it still reads
     * as belonging to its own curve; default 0.7
     */
    minHeightShare?: number
    /** Boxes labels mustn't cover, e.g. a button over the plot */
    obstacles?: LabelBox[]
}

/** Half the width of the spot above a peak that other curves' labels keep off */
const PEAK_SLOT_HALF_WIDTH = 3

/**
 * Places each curve's label just above it, where it clearly belongs to that
 * curve, without two labels (or a label and an obstacle) overlapping.
 * Curves are handled tallest peak first, and each label goes either
 *
 * 1. right above its curve's peak, or
 * 2. a little along its curve: at most `maxShift` label widths away from
 *    the peak, where the curve is at least `minHeightShare` of the peak's
 *    height, and not over another curve's peak; the spot nearest the peak
 *    wins.
 *
 * A label always sits above its curve along its whole width, and is shifted
 * horizontally to stay inside `bounds`. Labels are never stacked on top of
 * each other, which would read as belonging to the wrong curve: a label
 * that fits in neither way is dropped, for a legend to list instead.
 */
export function placeCurveLabels(
    candidates: CurveLabelCandidate[],
    options: CurveLabelOptions
): CurveLabelLayout {
    const { bounds, labelHeight } = options
    const curvePadding = options.curvePadding ?? 4
    const labelPadding = options.labelPadding ?? 2
    const maxShift = options.maxShift ?? 1.5
    const minHeightShare = options.minHeightShare ?? 0.7

    const occupied: LabelBox[] = [...(options.obstacles ?? [])]
    const placed = new Map<string, CurveLabel>()

    const withPeaks = candidates.flatMap((candidate, index) => {
        const peak = peakIndex(candidate.points)
        return peak === undefined
            ? []
            : [{ candidate, index, peak: candidate.points[peak] }]
    })
    // The spot right above each peak, where its own label would go
    const peakSlots = new Map(
        withPeaks.map(({ candidate, peak }): [string, LabelBox] => [
            candidate.key,
            {
                left: peak.x - PEAK_SLOT_HALF_WIDTH,
                right: peak.x + PEAK_SLOT_HALF_WIDTH,
                top: peak.y - curvePadding - labelHeight,
                bottom: peak.y,
            },
        ])
    )

    // Tallest peak first (smallest y); ties keep input order
    const ordered = withPeaks.toSorted(
        (a, b) => a.peak.y - b.peak.y || a.index - b.index
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
        const clearsOtherPeaks = (box: LabelBox): boolean =>
            [...peakSlots].every(
                ([key, slot]) =>
                    key === candidate.key || !overlaps(box, slot, 0)
            )

        // 1. Right above the peak
        let box: LabelBox | undefined = boxAt(peak.x)

        // 2. A little along the curve, nearest the peak first
        if (!fits(box)) {
            const minY =
                bounds.bottom - (bounds.bottom - peak.y) * minHeightShare
            box = points
                .filter(
                    (point) =>
                        point.y <= minY &&
                        Math.abs(point.x - peak.x) <= maxShift * width
                )
                .toSorted(
                    (a, b) =>
                        Math.abs(a.x - peak.x) - Math.abs(b.x - peak.x) ||
                        a.x - b.x
                )
                .map((point) => boxAt(point.x))
                .find(
                    (candidateBox) =>
                        fits(candidateBox) && clearsOtherPeaks(candidateBox)
                )
        }
        if (!box) continue

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

/**
 * Hides the labels a box listing the dropped curves would cover, adding them
 * to the dropped ones. The box grows with every curve it lists, so this
 * repeats until it covers no more labels; it never moves a label, so the
 * result is stable. `boxFor` gives the box for a list of keys, or undefined
 * when there'd be no box (nothing to list).
 */
export function hideLabelsUnderBox(
    layout: CurveLabelLayout,
    boxFor: (dropped: string[]) => LabelBox | undefined
): CurveLabelLayout {
    let { labels, dropped } = layout
    for (;;) {
        const box = boxFor(dropped)
        if (!box) return { labels, dropped }
        const covered = new Set(
            labels
                .filter((label) => overlaps(label.box, box, 0))
                .map((label) => label.key)
        )
        if (covered.size === 0) return { labels, dropped }
        labels = labels.filter((label) => !covered.has(label.key))
        dropped = [...dropped, ...covered]
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

function overlaps(a: LabelBox, b: LabelBox, padding: number): boolean {
    return (
        a.left < b.right + padding &&
        b.left < a.right + padding &&
        a.top < b.bottom + padding &&
        b.top < a.bottom + padding
    )
}
