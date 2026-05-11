import { PadObject, Position, RequiredBy } from "@ourworldindata/utils"
import { DumbbellHead, SizedDumbbellSeries } from "./DumbbellChartConstants.js"

export interface AxisLayout {
    domain: [number, number]
    pad: RequiredBy<PadObject, Position.left | Position.right>
}

/** Returns the start/end heads ordered by their spatial position on the axis */
export function toLeftRight<H extends DumbbellHead>(
    start: H,
    end: H
): { left: H; right: H } {
    return start.value <= end.value
        ? { left: start, right: end }
        : { left: end, right: start }
}

/**
 * Ensures every row's value labels fit inside the chart area by adjusting
 * the axis domain and/or adding padding.
 *
 * On each side, one of two strategies is used depending on whether the author
 * has specified a fixed domain edge:
 * - Unfixed: widen the domain so dots shift inward, making room for labels
 * - Fixed: preserve the user's domain edge; add padding instead
 *
 * Because the two sides interact (widening one shifts all dots), we iterate
 * until overflow is below a tolerance.
 */
export function calculateAxisLayout({
    series,
    domain,
    width,
    minFixed,
    maxFixed,
}: {
    series: SizedDumbbellSeries[]
    domain: [number, number]
    width: number
    minFixed: boolean
    maxFixed: boolean
}): AxisLayout {
    if (series.length === 0 || width <= 0)
        return { domain, pad: { left: 0, right: 0 } }

    const rows = series.map((series) => {
        const { left, right } = toLeftRight(series.start, series.end)
        return {
            left: {
                value: left.value,
                labelWidth: left.label
                    ? left.label.width + left.label.padding
                    : 0,
            },
            right: {
                value: right.value,
                labelWidth: right.label
                    ? right.label.width + right.label.padding
                    : 0,
            },
        }
    })

    let domainStart = domain[0]
    let domainEnd = domain[1]
    let padLeft = 0
    let padRight = 0

    const MAX_ITERATIONS = 5
    const TOLERANCE = 0.5 // px

    for (let i = 0; i < MAX_ITERATIONS; i++) {
        const domainSpan = domainEnd - domainStart
        const effectiveWidth = width - padLeft - padRight
        if (domainSpan <= 0 || effectiveWidth <= 0) break

        // Helper to convert a value to its pixel position along the axis
        const pixelsPerUnit = effectiveWidth / domainSpan
        const domainStartPixel = padLeft - domainStart * pixelsPerUnit
        const toPixel = (value: number): number =>
            domainStartPixel + value * pixelsPerUnit

        // Find the worst-case label overflow on each side
        let leftOverflow = 0
        let rightOverflow = 0
        for (const row of rows) {
            const leftX = toPixel(row.left.value)
            const rightX = toPixel(row.right.value)

            leftOverflow = Math.max(leftOverflow, row.left.labelWidth - leftX)
            rightOverflow = Math.max(
                rightOverflow,
                rightX + row.right.labelWidth - width
            )
        }

        // If both sides are within tolerance, we're done
        if (leftOverflow < TOLERANCE && rightOverflow < TOLERANCE) break

        // Convert pixel overflow to domain units. This slightly under-
        // corrects because it uses the pre-expansion ratio; the next
        // iteration handles the residual
        const unitsPerPixel = domainSpan / effectiveWidth
        if (leftOverflow >= TOLERANCE) {
            if (minFixed) padLeft += leftOverflow
            else domainStart -= leftOverflow * unitsPerPixel
        }
        if (rightOverflow >= TOLERANCE) {
            if (maxFixed) padRight += rightOverflow
            else domainEnd += rightOverflow * unitsPerPixel
        }
    }

    return {
        domain: [domainStart, domainEnd],
        pad: { left: padLeft, right: padRight },
    }
}
