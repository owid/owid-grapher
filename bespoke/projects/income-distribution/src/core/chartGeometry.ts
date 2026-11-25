import type { ScaleLinear, ScaleLogarithmic } from "d3-scale"
import { scaleLinear, scaleLog } from "@visx/scale"
import { area, curveMonotoneX, line } from "d3-shape"

import type { ChartSeries } from "./chartModel.js"

// The bottom holds the tick labels and, under them, the axis label, which
// takes two lines on narrow charts
export const MARGIN = { top: 10, right: 16, bottom: 58, left: 16 }
const MARGIN_BOTTOM_NARROW = 72

/** The plot's edges within the chart's container, in px */
export interface PlotRect {
    left: number
    right: number
    top: number
    bottom: number
}

/** The plot inside MARGIN, never collapsing below a pixel either way */
export function plotRect(
    width: number,
    height: number,
    isNarrow: boolean
): PlotRect {
    const left = MARGIN.left
    const top = MARGIN.top
    return {
        left,
        right: Math.max(width - MARGIN.right, left + 1),
        top,
        bottom: Math.max(
            height - (isNarrow ? MARGIN_BOTTOM_NARROW : MARGIN.bottom),
            top + 1
        ),
    }
}

/** The log income axis over the grid's extent, clamped so nothing goes off the plot */
export function makeXScale(
    incomes: number[],
    range: [number, number]
): ScaleLogarithmic<number, number> {
    return scaleLog<number>({
        domain: [incomes[0], incomes[incomes.length - 1]],
        range,
        clamp: true,
    })
}

/** The linear density axis up to `yMax` (or 1, when there's nothing to draw) */
export function makeYScale(
    yMax: number,
    range: [number, number]
): ScaleLinear<number, number> {
    return scaleLinear<number>({
        domain: [0, yMax > 0 ? yMax : 1],
        range,
    })
}

/** Below this share of a series' tallest point, it has no data worth drawing */
const EMPTY_HEIGHT_RATIO = 1e-3

/**
 * One area path per series. By default, outside the range where a series
 * has any height, as beyond a country's data, the path stops rather than
 * running on along the axis as a flat line; within that range it stays in
 * one piece, through any dip to nothing between bumps. `trimEmptyEnds:
 * false` draws the whole grid.
 */
export function computeAreaPaths(
    series: Pick<ChartSeries, "y0" | "y1">[],
    incomes: number[],
    xScale: ScaleLogarithmic<number, number>,
    yScale: ScaleLinear<number, number>,
    { trimEmptyEnds = true }: { trimEmptyEnds?: boolean } = {}
): string[] {
    return series.map((s) => {
        const heights = s.y1.map((y, i) => y - s.y0[i])
        const threshold = Math.max(...heights) * EMPTY_HEIGHT_RATIO
        const first = trimEmptyEnds
            ? heights.findIndex((h) => h > threshold)
            : 0
        const last = trimEmptyEnds
            ? heights.findLastIndex((h) => h > threshold)
            : heights.length - 1
        const generator = area<number>()
            .defined((_, i) => i >= first && i <= last)
            .x((_, i) => xScale(incomes[i]))
            .y0((_, i) => yScale(s.y0[i]))
            .y1((_, i) => yScale(s.y1[i]))
            .curve(curveMonotoneX)
        return generator(s.y1) ?? ""
    })
}

/**
 * The top of the stack as a line, and the area under it down to the axis:
 * the emphasised outline of the global total, and the fill below the line
 */
export function computeTotalPaths(
    totalTop: number[],
    incomes: number[],
    xScale: ScaleLogarithmic<number, number>,
    yScale: ScaleLinear<number, number>
): { outline: string; area: string } {
    const x = (_: number, i: number): number => xScale(incomes[i])
    return {
        outline:
            line<number>()
                .x(x)
                .y((y) => yScale(y))
                .curve(curveMonotoneX)(totalTop) ?? "",
        area:
            area<number>()
                .x(x)
                .y0(yScale(0))
                .y1((y) => yScale(y))
                .curve(curveMonotoneX)(totalTop) ?? "",
    }
}
