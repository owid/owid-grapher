import * as R from "remeda"
import { describe, expect, it } from "vitest"

import {
    hideLabelsUnderBox,
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

    it("moves a colliding label a little along its curve, keeping the tallest peak's label in place", () => {
        const { labels, dropped } = placeCurveLabels(
            [triangle("Low", 310, 110), triangle("High", 300, 100)],
            OPTIONS
        )
        expect(dropped).toEqual([])
        const byKey = R.indexBy(labels, (l) => l.key)
        expect(byKey.High.x).toBe(300)
        // Low's label moved off its peak, clear of High's label...
        expect(byKey.Low.x).not.toBe(310)
        expect(boxesOverlap(byKey.Low.box, byKey.High.box)).toBe(false)
        // ...but no more than 1.5 label widths, on the top 30% of its curve
        expect(Math.abs(byKey.Low.x - 310)).toBeLessThanOrEqual(1.5 * 60)
        expect(byKey.Low.y).toBeLessThan(300 - 0.7 * 190)
    })

    it("drops a label rather than stack it above another", () => {
        // Too narrow a curve to move along
        const { labels, dropped } = placeCurveLabels(
            [
                triangle("High", 300, 100),
                triangle("Narrow", 300, 110, { halfWidth: 30 }),
            ],
            OPTIONS
        )
        expect(labels.map((l) => l.key)).toEqual(["High"])
        expect(dropped).toEqual(["Narrow"])
    })

    it("doesn't move a label further than allowed from its peak", () => {
        // A broad curve with its middle covered: room only far from the peak
        const broad = triangle("A", 300, 100, { halfWidth: 600 })
        const obstacle = { left: 210, right: 390, top: 0, bottom: 300 }
        expect(
            placeCurveLabels([broad], { ...OPTIONS, obstacles: [obstacle] })
                .dropped
        ).toEqual(["A"])
        expect(
            placeCurveLabels([broad], {
                ...OPTIONS,
                obstacles: [obstacle],
                maxShift: 3,
            }).labels
        ).toHaveLength(1)
    })

    it("keeps a moved label off another curve's peak", () => {
        const { labels } = placeCurveLabels(
            [
                triangle("A", 300, 100),
                triangle("B", 330, 110, { halfWidth: 600 }),
                // Where B's label would otherwise move to
                triangle("C", 280, 115, { halfWidth: 20 }),
            ],
            OPTIONS
        )
        const b = labels.find((l) => l.key === "B")!
        expect(b).toBeDefined()
        expect(b.box.left > 283 || b.box.right < 277).toBe(true)
    })

    it("leaves some of many close peaks unlabelled, and never floats a label above its curve", () => {
        const curves = [
            triangle("A", 300, 100),
            triangle("B", 310, 104),
            triangle("C", 320, 108),
            triangle("D", 290, 112),
            triangle("E", 330, 116),
        ]
        const { labels, dropped } = placeCurveLabels(curves, OPTIONS)
        expect(dropped.length).toBeGreaterThan(0)
        expect(labels.length + dropped.length).toBe(curves.length)
        for (const label of labels) {
            // Resting on its own curve's highest point under it, not
            // floating higher up
            const { points } = curves.find((c) => c.key === label.key)!
            const { left, right, bottom } = label.box
            const highestWithin = Math.min(
                ...points
                    .filter((p) => p.x >= left && p.x <= right)
                    .map((p) => p.y)
            )
            const highestAround = Math.min(
                ...points
                    .filter((p) => p.x >= left - 10 && p.x <= right + 10)
                    .map((p) => p.y)
            )
            expect(bottom).toBeLessThanOrEqual(highestWithin - 4)
            expect(bottom).toBeGreaterThanOrEqual(highestAround - 4)
        }
        for (const [a, b] of R.pipe(labels, (ls) =>
            ls.flatMap((l, i) => ls.slice(i + 1).map((m) => [l, m] as const))
        ))
            expect(boxesOverlap(a.box, b.box)).toBe(false)
    })

    it("drops a label that fits nowhere and reports it", () => {
        // No room above the peaks
        const { labels, dropped } = placeCurveLabels(
            [triangle("A", 300, 20), triangle("B", 300, 22, { halfWidth: 30 })],
            OPTIONS
        )
        expect(labels.map((l) => l.key)).toEqual(["A"])
        expect(dropped).toEqual(["B"])
    })

    it("avoids obstacles", () => {
        const obstacle = { left: 280, right: 320, top: 70, bottom: 100 }
        const { labels } = placeCurveLabels(
            [triangle("A", 300, 100, { halfWidth: 400 })],
            {
                ...OPTIONS,
                obstacles: [obstacle],
            }
        )
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

describe(hideLabelsUnderBox, () => {
    const layout = placeCurveLabels(
        [
            triangle("Left", 100, 100),
            triangle("Middle", 300, 100),
            triangle("Right", 500, 100),
        ],
        OPTIONS
    )

    it("leaves the labels alone when there's no box", () => {
        expect(hideLabelsUnderBox(layout, () => undefined)).toEqual(layout)
    })

    it("hides the labels the box covers, growing it until it covers no more", () => {
        // A box in the top-right corner that grows leftwards with every row
        const boxFor = (keys: string[]): LabelBox | undefined => ({
            left: 520 - 150 * keys.length,
            right: 600,
            top: 0,
            bottom: 120,
        })
        const result = hideLabelsUnderBox(
            { ...layout, dropped: ["Gone"] },
            boxFor
        )
        // One row covers Right; two rows reach Middle; three reach Left
        expect(result.labels).toEqual([])
        expect(result.dropped).toEqual(["Gone", "Right", "Middle", "Left"])
    })

    it("keeps the labels it doesn't cover where they were", () => {
        const result = hideLabelsUnderBox(layout, () => ({
            left: 520,
            right: 600,
            top: 0,
            bottom: 120,
        }))
        expect(result.labels.map((l) => l.key)).toEqual(["Left", "Middle"])
        expect(result.labels).toEqual(layout.labels.slice(0, 2))
        expect(result.dropped).toEqual(["Right"])
    })
})
