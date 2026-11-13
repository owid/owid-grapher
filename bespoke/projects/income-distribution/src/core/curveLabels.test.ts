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

/** Whether `key`'s curve is the topmost one (within 2 px) under its label */
function isTopmostUnder(
    curves: CurveLabelCandidate[],
    key: string,
    box: LabelBox
): boolean {
    const own = curves.find((c) => c.key === key)!
    return own.points
        .map((point, i) => ({ point, i }))
        .filter(({ point }) => point.x >= box.left && point.x <= box.right)
        .every(({ point, i }) =>
            curves.every((c) => c.points[i].y >= point.y - 2)
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

    it("in a chart of few curves, moves a label a little along its curve to where it's the topmost one", () => {
        // A's steep mountain rises above B's broad, low one around B's
        // peak; B's mountain is the topmost again a little to the right
        const curves = [
            triangle("A", 300, 100, { halfWidth: 100 }),
            triangle("B", 330, 200, { halfWidth: 300 }),
        ]
        const { labels, dropped } = placeCurveLabels(curves, OPTIONS)
        expect(dropped).toEqual([])
        const b = labels.find((l) => l.key === "B")!
        expect(b.x).toBeGreaterThan(330)
        expect(b.x - 330).toBeLessThanOrEqual(1.5 * 60)
        expect(isTopmostUnder(curves, "B", b.box)).toBe(true)

        // With more curves than allowed to shift, B only gets its peak
        expect(
            placeCurveLabels(curves, { ...OPTIONS, maxCurvesForShift: 1 })
                .dropped
        ).toEqual(["B"])
    })

    it("drops a label under a taller curve rather than let it read as that curve's", () => {
        const curves = [
            triangle("A", 300, 100, { halfWidth: 200 }),
            triangle("B", 350, 180, { halfWidth: 50 }),
        ]
        const { labels, dropped } = placeCurveLabels(curves, OPTIONS)
        expect(labels.map((l) => l.key)).toEqual(["A"])
        expect(dropped).toEqual(["B"])
    })

    it("keeps a margin free around each label", () => {
        // Same heights, labels touching: too close
        const curves = [triangle("A", 200, 100), triangle("B", 260, 100)]
        const noShift = { ...OPTIONS, maxCurvesForShift: 1 }
        expect(placeCurveLabels(curves, noShift).dropped).toEqual(["B"])
        expect(
            placeCurveLabels(curves, {
                ...noShift,
                labelMargin: { x: 0, y: 0 },
            }).dropped
        ).toEqual([])
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

    it("places at most `maxLabels`, tallest peaks first", () => {
        const { labels, dropped } = placeCurveLabels(
            [
                triangle("Short", 100, 200),
                triangle("Tallest", 300, 50),
                triangle("Tall", 500, 100),
            ],
            { ...OPTIONS, maxLabels: 2 }
        )
        expect(labels.map((l) => l.key)).toEqual(["Tallest", "Tall"])
        expect(dropped).toEqual(["Short"])
    })

    it("labels only a few of many close peaks, each with room and on its own mountain", () => {
        // Twelve peaks 25px apart, every third one taller than its neighbours
        const curves = R.range(0, 12).map((i) =>
            triangle(`C${i}`, 150 + i * 25, 100 + (i % 3) * 40)
        )
        const { labels, dropped } = placeCurveLabels(curves, {
            ...OPTIONS,
            maxLabels: 3,
        })
        expect(labels.length).toBeGreaterThan(0)
        expect(labels.length).toBeLessThanOrEqual(3)
        expect(labels.length + dropped.length).toBe(12)
        for (const label of labels) {
            expect(isTopmostUnder(curves, label.key, label.box)).toBe(true)
            // Directly above the peak: too many curves to move along them
            const own = curves.find((c) => c.key === label.key)!
            const peak = R.firstBy(own.points, (p) => p.y)!
            expect(label.x).toBe(peak.x)
        }
        for (const [i, a] of labels.entries())
            for (const b of labels.slice(i + 1))
                expect(
                    boxesOverlap(
                        {
                            left: a.box.left - 10,
                            right: a.box.right + 10,
                            top: a.box.top - 6,
                            bottom: a.box.bottom + 6,
                        },
                        b.box
                    )
                ).toBe(false)
    })

    it("drops a label that fits nowhere and reports it", () => {
        const { labels, dropped } = placeCurveLabels(
            [triangle("A", 300, 20), triangle("B", 300, 40, { halfWidth: 30 })],
            OPTIONS
        )
        expect(labels.map((l) => l.key)).toEqual(["A"])
        expect(dropped).toEqual(["B"])
    })

    it("avoids obstacles", () => {
        const obstacle = { left: 280, right: 320, top: 70, bottom: 100 }
        const { labels } = placeCurveLabels(
            [triangle("A", 300, 100, { halfWidth: 400 })],
            { ...OPTIONS, obstacles: [obstacle] }
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
