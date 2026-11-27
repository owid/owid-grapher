import type { CSSProperties, ReactNode } from "react"
import * as R from "remeda"
import type { ScaleLinear, ScaleLogarithmic } from "d3-scale"

import type { ChartSeries } from "./chartModel.js"
import type { ChartAnnotation } from "./presentation.js"

/** An offset in px */
export interface ChartOffset {
    dx: number
    dy: number
}

/** A point on the chart an annotation points at */
export interface ChartAnnotationTarget {
    /** Int-$/day */
    income: number
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
    /** An arrow from `from` to just short of the target, bent by the handle */
    arrow?: {
        from: ChartOffset
        startHandle?: ChartOffset
        /** Room left between the arrow's head and the target, in px */
        gap?: number
    }
}

export interface ChartPoint {
    x: number
    y: number
}

/** The value of `values` (one per grid point) at `income`, interpolated on the log axis */
export function valueAtIncome(
    values: number[],
    incomes: number[],
    income: number
): number {
    const i = R.sortedIndex(incomes, income)
    if (i <= 0) return values[0]
    if (i >= incomes.length) return values[values.length - 1]
    const t =
        (Math.log(income) - Math.log(incomes[i - 1])) /
        (Math.log(incomes[i]) - Math.log(incomes[i - 1]))
    return values[i - 1] + t * (values[i] - values[i - 1])
}

/** The parts of the chart model a target is found on */
export interface AnnotationModel {
    grid: { incomes: number[] }
    series: Pick<ChartSeries, "key" | "y0" | "y1">[]
}

/** Where an annotation's target is on the chart, in px */
export function annotationTargetPoint(
    target: ChartAnnotationTarget,
    {
        model,
        xScale,
        yScale,
        plotTop,
        plotBottom,
    }: {
        model: AnnotationModel
        xScale: ScaleLogarithmic<number, number>
        yScale: ScaleLinear<number, number>
        plotTop: number
        plotBottom: number
    }
): ChartPoint {
    const { income } = target
    const x = xScale(income)
    if ("plot" in target.y)
        return { x, y: plotTop + target.y.plot * (plotBottom - plotTop) }
    const { curve, fraction = 1 } = target.y
    const series =
        curve === "total"
            ? model.series[model.series.length - 1]
            : model.series.find((s) => s.key === curve)
    if (!series) return { x, y: plotBottom }
    const top = valueAtIncome(series.y1, model.grid.incomes, income)
    const bottom = valueAtIncome(series.y0, model.grid.incomes, income)
    return { x, y: yScale(bottom + fraction * (top - bottom)) }
}

export interface PlacedAnnotation {
    key: string
    content: ReactNode
    /** Of the text block, absolutely positioned in the chart's container */
    style: CSSProperties
    /** A BezierArrow's points */
    arrow?: {
        start: ChartPoint
        end: ChartPoint
        startHandle?: ChartPoint
        endHandle?: ChartPoint
    }
}

/** Pixel positions of an annotation's text and arrow, the text kept inside the chart */
export function placeAnnotation(
    annotation: ChartAnnotation,
    { target, width }: { target: ChartPoint; width: number }
): PlacedAnnotation {
    const { textOffset, textAnchor = "top-left", arrow } = annotation
    const blockWidth = Math.min(annotation.width, width)
    const anchorX = target.x + textOffset.dx
    const anchorY = target.y + textOffset.dy
    const isRight = textAnchor.endsWith("right")
    const left = R.clamp(isRight ? anchorX - blockWidth : anchorX, {
        min: 0,
        max: Math.max(width - blockWidth, 0),
    })
    const style: CSSProperties = {
        left,
        width: blockWidth,
        textAlign: isRight ? "right" : "left",
        ...(textAnchor.startsWith("top")
            ? { top: anchorY }
            : { top: anchorY, transform: "translateY(-100%)" }),
    }

    let placedArrow: PlacedAnnotation["arrow"]
    if (arrow) {
        const start = {
            x: target.x + arrow.from.dx,
            y: target.y + arrow.from.dy,
        }
        // Stop short of the target, along the line from the start
        const gap = arrow.gap ?? 4
        const distance = Math.hypot(target.x - start.x, target.y - start.y)
        const ratio = distance > gap ? (distance - gap) / distance : 0
        const end = {
            x: start.x + (target.x - start.x) * ratio,
            y: start.y + (target.y - start.y) * ratio,
        }
        const startHandle = arrow.startHandle
            ? {
                  x: start.x + arrow.startHandle.dx,
                  y: start.y + arrow.startHandle.dy,
              }
            : undefined
        // The curve's end tangent runs from the start handle, so the head is
        // set along that; left out, the arrow would aim its head along the
        // straight line from its start
        const endHandle = startHandle
            ? {
                  x: end.x + (startHandle.x - end.x) * 0.3,
                  y: end.y + (startHandle.y - end.y) * 0.3,
              }
            : undefined
        placedArrow = { start, end, startHandle, endHandle }
    }

    return {
        key: annotation.key,
        content: annotation.content,
        style,
        arrow: placedArrow,
    }
}
