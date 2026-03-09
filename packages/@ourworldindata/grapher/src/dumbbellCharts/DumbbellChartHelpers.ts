import { PadObject, Position, RequiredBy } from "@ourworldindata/utils"
import { SizedDumbbellSeries } from "./DumbbellChartConstants.js"

export interface AxisLayout {
    domain: [number, number]
    pad: RequiredBy<PadObject, Position.left | Position.right>
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
    isLog,
    minFixed,
    maxFixed,
}: {
    series: SizedDumbbellSeries[]
    domain: [number, number]
    width: number
    isLog: boolean
    minFixed: boolean
    maxFixed: boolean
}): AxisLayout {
    if (series.length === 0 || width <= 0)
        return { domain, pad: { left: 0, right: 0 } }

    const rows = series.map((series) => ({
        left: {
            value: series.left.value,
            labelWidth: series.left.label.width + series.left.label.padding,
        },
        right: {
            value: series.right.value,
            labelWidth: series.right.label.width + series.right.label.padding,
        },
    }))

    const toScale = (v: number): number => (isLog ? Math.log(v) : v)
    const fromScale = (v: number): number => (isLog ? Math.exp(v) : v)

    let domainStart = toScale(domain[0])
    let domainEnd = toScale(domain[1])
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
            domainStartPixel + toScale(value) * pixelsPerUnit

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
        domain: [fromScale(domainStart), fromScale(domainEnd)],
        pad: { left: padLeft, right: padRight },
    }
}
