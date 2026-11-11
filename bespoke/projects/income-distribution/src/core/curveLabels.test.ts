import * as R from "remeda"
import { describe, expect, it } from "vitest"

import {
    placeCurveLabels,
    type LabelBox,
    type CurveLabelCandidate,
    type CurveLabelOptions,
} from "./curveLabels.js"

const BOUNDS = { left: 0, right: 600, top: 0, bottom: 300 }
const OPTIONS: CurveLabelOptions = {
    bounds: BOUNDS,
    labelHeight: 12,
    curvePadding: 4,
    labelPadding: 2,
}

/**
 * A triangular curve on a 0–600 px grid (one point every 10 px), peaking
 * at `peakX` with `peakY` and reaching the baseline `halfWidth` px either side
 */
function triangle(
    key: string,
    peakX: number,
    peakY: number,
    options: { width?: number; halfWidth?: number } = {}
): CurveLabelCandidate {
    const halfWidth = options.halfWidth ?? 150
    return {
        key,
        width: options.width ?? 60,
        points: R.range(0, 61).map((i) => {
            const x = i * 10
            const share = Math.max(0, 1 - Math.abs(x - peakX) / halfWidth)
            return { x, y: BOUNDS.bottom - share * (BOUNDS.bottom - peakY) }
        }),
    }
}

function boxesOverlap(a: LabelBox, b: LabelBox): boolean {
    return (
        a.left < b.right &&
        b.left < a.right &&
        a.top < b.bottom &&
        b.top < a.bottom
    )
}

describe(placeCurveLabels, () => {
    it("puts a lone label just above its curve's peak", () => {
        const { labels, dropped } = placeCurveLabels(
            [triangle("A", 300, 100)],
            OPTIONS
        )
        expect(dropped).toEqual([])
        expect(labels).toHaveLength(1)
        expect(labels[0].x).toBe(300)
        expect(labels[0].y).toBe(96)
    })

    it("keeps the whole label above the curve, not just its centre", () => {
        // On a steep slope, the label's edges are higher than its centre
        const [label] = placeCurveLabels(
            [triangle("A", 300, 100, { width: 100, halfWidth: 100 })],
            OPTIONS
        ).labels
        expect(label.box.bottom).toBeLessThanOrEqual(100 - 4)
    })

    it("shifts a label near the edge into the bounds", () => {
        const [label] = placeCurveLabels(
            [triangle("A", 10, 100, { width: 80 })],
            OPTIONS
        ).labels
        expect(label.box.left).toBe(0)
        expect(label.x).toBe(40)
    })

    it("labels far-apart peaks at their peaks", () => {
        const { labels } = placeCurveLabels(
            [triangle("A", 100, 100), triangle("B", 450, 150)],
            OPTIONS
        )
        expect(labels.map((l) => [l.key, l.x])).toEqual([
            ["A", 100],
            ["B", 450],
        ])
    })

    it("moves a colliding label along its curve, keeping the tallest peak's label in place", () => {
        const { labels, dropped } = placeCurveLabels(
            [triangle("Low", 310, 110), triangle("High", 300, 100)],
            OPTIONS
        )
        expect(dropped).toEqual([])
        const byKey = R.indexBy(labels, (l) => l.key)
        expect(byKey.High.x).toBe(300)
        // Low's label moved off its peak, clear of High's label
        expect(byKey.Low.x).not.toBe(310)
        expect(boxesOverlap(byKey.Low.box, byKey.High.box)).toBe(false)
        // ...but stayed on the upper half of its own curve
        expect(byKey.Low.y).toBeLessThan(300 - 0.5 * 190)
    })

    it("stacks a label above the others when its curve is too narrow to move along", () => {
        const { labels, dropped } = placeCurveLabels(
            [
                triangle("High", 300, 100),
                triangle("Narrow", 300, 110, { halfWidth: 30 }),
            ],
            OPTIONS
        )
        expect(dropped).toEqual([])
        const byKey = R.indexBy(labels, (l) => l.key)
        expect(byKey.Narrow.x).toBe(300)
        expect(byKey.Narrow.box.bottom).toBeLessThanOrEqual(
            byKey.High.box.top - 2
        )
    })

    it("drops a label that fits nowhere and reports it", () => {
        // No room above the peaks to stack into
        const { labels, dropped } = placeCurveLabels(
            [triangle("A", 300, 20), triangle("B", 300, 22, { halfWidth: 30 })],
            OPTIONS
        )
        expect(labels.map((l) => l.key)).toEqual(["A"])
        expect(dropped).toEqual(["B"])
    })

    it("avoids obstacles", () => {
        const obstacle = { left: 250, right: 350, top: 70, bottom: 100 }
        const { labels } = placeCurveLabels([triangle("A", 300, 100)], {
            ...OPTIONS,
            obstacles: [obstacle],
        })
        expect(labels).toHaveLength(1)
        expect(boxesOverlap(labels[0].box, obstacle)).toBe(false)
    })

    it("returns labels in input order", () => {
        const { labels } = placeCurveLabels(
            [triangle("Low", 100, 200), triangle("High", 450, 50)],
            OPTIONS
        )
        expect(labels.map((l) => l.key)).toEqual(["Low", "High"])
    })
})
