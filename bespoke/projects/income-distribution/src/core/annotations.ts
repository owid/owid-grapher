/** An offset in px */
export interface ChartOffset {
    dx: number
    dy: number
}

/** A point on the chart an annotation points at */
export interface ChartAnnotationTarget {
    /** Int-$/day, or wherever the poverty line currently is */
    income: number | "povertyLine"
    /**
     * How high: a fraction (0–1, default 1) of a curve's height at that
     * income, the curve being a series key or `total` (the top of the
     * stack); or a fraction of the plot's height from its top
     */
    y: { curve: string; fraction?: number } | { plot: number }
}

/**
 * Where text placed next to the data goes, with an optional curved arrow
 * pointing at it. Offsets are in px from the target, so the annotation
 * follows the data as the chart resizes.
 */
export interface AnnotationPlacement {
    target: ChartAnnotationTarget
    /** Where the text block's anchor corner sits */
    textOffset: ChartOffset
    /** Which corner of the text block sits at the anchor; default top-left */
    textAnchor?: "top-left" | "top-right" | "bottom-left" | "bottom-right"
    /** Width of the text block, in px */
    width: number
    /** An arrow from `from` to just short of the target, bent by the handles */
    arrow?: {
        from: ChartOffset
        startHandle?: ChartOffset
        endHandle?: ChartOffset
        /** Room left between the arrow's head and the target, in px */
        gap?: number
    }
}
