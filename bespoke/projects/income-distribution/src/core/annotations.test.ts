import { describe, expect, it } from "vitest"
import { scaleLinear, scaleLog } from "@visx/scale"

import {
    annotationTargetPoint,
    placeAnnotation,
    valueAtIncome,
} from "./annotations.js"
import type { ChartAnnotation } from "./presentation.js"

// Three grid points a decade apart; one curve peaking at $10, on top of
// another flat one
const INCOMES = [1, 10, 100]
const MODEL = {
    grid: { incomes: INCOMES },
    series: [
        { key: "Base", y0: [0, 0, 0], y1: [2, 2, 2] },
        { key: "Peak", y0: [2, 2, 2], y1: [2, 12, 2] },
    ],
}
// A 100px wide, 100px tall plot with 1 unit = 5px
const xScale = scaleLog<number>({ domain: [1, 100], range: [0, 100] })
const yScale = scaleLinear<number>({ domain: [0, 20], range: [100, 0] })
const scales = { model: MODEL, xScale, yScale, plotTop: 0, plotBottom: 100 }

describe(valueAtIncome, () => {
    it("interpolates on the log axis and holds the ends", () => {
        expect(valueAtIncome([0, 10, 20], INCOMES, Math.sqrt(10))).toBeCloseTo(
            5
        )
        expect(valueAtIncome([0, 10, 20], INCOMES, 0.5)).toBe(0)
        expect(valueAtIncome([0, 10, 20], INCOMES, 500)).toBe(20)
    })
})

describe(annotationTargetPoint, () => {
    it("takes a fraction of the plot's height from its top", () => {
        expect(
            annotationTargetPoint({ income: 10, y: { plot: 0.25 } }, scales)
        ).toEqual({ x: 50, y: 25 })
    })

    it("takes a fraction of a curve's height at the income, from its bottom edge", () => {
        // Peak is 10 tall at $10, on a base of 2: half way up is 7
        expect(
            annotationTargetPoint(
                { income: 10, y: { curve: "Peak", fraction: 0.5 } },
                scales
            )
        ).toEqual({ x: 50, y: yScale(7) })
        // The whole height by default
        expect(
            annotationTargetPoint({ income: 10, y: { curve: "Peak" } }, scales)
        ).toEqual({ x: 50, y: yScale(12) })
    })

    it("reads `total` as the top of the stack, and falls to the baseline for an unknown curve", () => {
        expect(
            annotationTargetPoint({ income: 10, y: { curve: "total" } }, scales)
        ).toEqual({ x: 50, y: yScale(12) })
        expect(
            annotationTargetPoint({ income: 10, y: { curve: "Nope" } }, scales)
        ).toEqual({ x: 50, y: 100 })
    })
})

describe(placeAnnotation, () => {
    const annotation = (
        overrides: Partial<ChartAnnotation> = {}
    ): ChartAnnotation => ({
        key: "a",
        content: "text",
        target: { income: 10, y: { plot: 0 } },
        textOffset: { dx: 10, dy: 20 },
        width: 100,
        ...overrides,
    })
    const target = { x: 200, y: 50 }

    it("puts the text block's anchor corner at the offset from the target", () => {
        expect(
            placeAnnotation(annotation(), { target, width: 600 }).style
        ).toEqual({
            left: 210,
            top: 70,
            width: 100,
            textAlign: "left",
        })
        expect(
            placeAnnotation(annotation({ textAnchor: "bottom-right" }), {
                target,
                width: 600,
            }).style
        ).toEqual({
            left: 110,
            top: 70,
            width: 100,
            textAlign: "right",
            transform: "translateY(-100%)",
        })
    })

    it("keeps the text inside the chart's width", () => {
        const { style } = placeAnnotation(
            annotation({ textOffset: { dx: 80, dy: 0 } }),
            { target, width: 250 }
        )
        expect(style.left).toBe(150)
        const { style: narrow } = placeAnnotation(annotation(), {
            target,
            width: 60,
        })
        expect(narrow).toMatchObject({ left: 0, width: 60 })
    })

    it("has no arrow unless asked for one", () => {
        expect(
            placeAnnotation(annotation(), { target, width: 600 }).arrow
        ).toBeUndefined()
    })

    it("draws the arrow from its offset to `gap` short of the target", () => {
        const { arrow } = placeAnnotation(
            annotation({ arrow: { from: { dx: -30, dy: -40 }, gap: 5 } }),
            { target, width: 600 }
        )
        // 50px long, so the end stops 5px (a tenth) short along the line
        expect(arrow?.start).toEqual({ x: 170, y: 10 })
        expect(arrow?.end).toEqual({ x: 197, y: 46 })
        expect(arrow?.startHandle).toBeUndefined()
        expect(arrow?.endHandle).toBeUndefined()
    })

    it("derives the end handle from the start handle, so the head follows the curve", () => {
        const { arrow } = placeAnnotation(
            annotation({
                arrow: {
                    from: { dx: -30, dy: -40 },
                    startHandle: { dx: 10, dy: 0 },
                    gap: 5,
                },
            }),
            { target, width: 600 }
        )
        expect(arrow?.startHandle).toEqual({ x: 180, y: 10 })
        // Three tenths of the way from the end back to the start handle
        expect(arrow?.endHandle?.x).toBeCloseTo(197 + (180 - 197) * 0.3)
        expect(arrow?.endHandle?.y).toBeCloseTo(46 + (10 - 46) * 0.3)
    })
})
