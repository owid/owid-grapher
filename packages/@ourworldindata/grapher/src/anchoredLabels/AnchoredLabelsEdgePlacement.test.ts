import { describe, expect, it } from "vitest"

import {
    EdgeLabelToPlace,
    separateLabelsNearAnchors,
    placeEdgeLabels,
} from "./AnchoredLabelsEdgePlacement"

const range = { top: 0, bottom: 200 }

const label = (id: string, anchorY: number, height = 10): EdgeLabelToPlace => ({
    id,
    anchorY,
    height,
})

describe(separateLabelsNearAnchors, () => {
    it("keeps labels on their anchors when nothing overlaps", () => {
        const positions = separateLabelsNearAnchors(
            [label("a", 40), label("b", 100), label("c", 160)],
            range,
            2
        )
        expect(positions.get("a")).toBeCloseTo(40)
        expect(positions.get("b")).toBeCloseTo(100)
        expect(positions.get("c")).toBeCloseTo(160)
    })

    it("splits the shift evenly between overlapping labels", () => {
        const positions = separateLabelsNearAnchors(
            [label("a", 50), label("b", 52)],
            range,
            2
        )
        expect(positions.get("a")).toBeCloseTo(45)
        expect(positions.get("b")).toBeCloseTo(57)
    })

    it("orders labels by anchor and keeps the gap between neighbors", () => {
        const positions = separateLabelsNearAnchors(
            [label("c", 52), label("a", 48), label("b", 50), label("d", 51)],
            range,
            2
        )
        const ids = [...positions.entries()]
            .sort(([, y1], [, y2]) => y1 - y2)
            .map(([id]) => id)
        expect(ids).toEqual(["a", "b", "d", "c"])

        const ys = ids.map((id) => positions.get(id)!)
        for (let i = 1; i < ys.length; i++) {
            expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(12 - 1e-9)
        }
    })

    it("returns nothing for no labels", () => {
        expect(separateLabelsNearAnchors([], range, 2).size).toBe(0)
    })

    it("keeps input order for labels with the same anchor", () => {
        const positions = separateLabelsNearAnchors(
            [label("b", 50), label("a", 50)],
            range,
            2
        )
        expect(positions.get("b")).toBeCloseTo(44)
        expect(positions.get("a")).toBeCloseTo(56)
    })

    it("pins labels taller than the range to its top", () => {
        const positions = separateLabelsNearAnchors(
            [label("a", 10), label("b", 12)],
            { top: 0, bottom: 15 },
            2
        )
        expect(positions.get("a")).toBeCloseTo(5)
        expect(positions.get("b")).toBeCloseTo(17)
    })

    it("clamps labels pressed against the range edges and keeps the gaps", () => {
        const top = separateLabelsNearAnchors(
            [label("a", 1), label("b", 2), label("c", 3)],
            range,
            2
        )
        expect(top.get("a")).toBeCloseTo(5)
        expect(top.get("b")).toBeCloseTo(17)
        expect(top.get("c")).toBeCloseTo(29)

        const bottom = separateLabelsNearAnchors(
            [label("a", 198), label("b", 199), label("c", 200)],
            range,
            2
        )
        expect(bottom.get("a")).toBeCloseTo(171)
        expect(bottom.get("b")).toBeCloseTo(183)
        expect(bottom.get("c")).toBeCloseTo(195)
    })
})

describe(placeEdgeLabels, () => {
    it("hides the lowest-priority labels that exceed the height budget", () => {
        const placements = placeEdgeLabels(
            [label("a", 5), label("b", 17), label("c", 29)],
            { range: { top: 0, bottom: 30 }, gap: 2, maxShift: Infinity }
        )
        expect(placements).toEqual(
            new Map([
                ["a", 5],
                ["b", 17],
            ])
        )
    })

    it("leaves out a label that would push a higher-priority one beyond the cap", () => {
        // Separated, they sit at 92, 104, 116, so only x moves more than 6
        const placements = placeEdgeLabels(
            [label("x", 100), label("y", 100), label("z", 112)],
            { range, gap: 2, maxShift: 6 }
        )
        expect(placements).toEqual(
            new Map([
                ["x", 94],
                ["y", 106],
            ])
        )
    })

    it("keeps labels that fill the height budget exactly", () => {
        const placements = placeEdgeLabels(
            [label("a", 5), label("b", 17), label("c", 29)],
            { range: { top: 0, bottom: 34 }, gap: 2, maxShift: Infinity }
        )
        expect(placements).toEqual(
            new Map([
                ["a", 5],
                ["b", 17],
                ["c", 29],
            ])
        )
    })

    it("leaves out a label that would push one below it beyond the cap", () => {
        // Separated, they sit at 84, 96, 108, so only y, at the bottom, moves more than 6
        const placements = placeEdgeLabels(
            [label("x", 100), label("y", 100), label("z", 88)],
            { range, gap: 2, maxShift: 6 }
        )
        expect(placements).toEqual(
            new Map([
                ["x", 94],
                ["y", 106],
            ])
        )
    })

    it("keeps a lower-priority label that fits after a higher one is left out", () => {
        // a, b and c crowd at 100, so c is left out; d still fits at its
        // anchor below a and b
        const placements = placeEdgeLabels(
            [
                label("a", 100),
                label("b", 100),
                label("c", 100),
                label("d", 124),
            ],
            { range, gap: 2, maxShift: 6 }
        )
        expect(placements).toEqual(
            new Map([
                ["a", 94],
                ["b", 106],
                ["d", 124],
            ])
        )
    })

    it("spends the height budget only on labels kept within the cap", () => {
        // The budget fits two labels; b, pushed 12px off its shared anchor
        // with a, is left out, which leaves room for c
        const placements = placeEdgeLabels(
            [label("a", 5), label("b", 5), label("c", 17)],
            { range: { top: 0, bottom: 22 }, gap: 2, maxShift: 6 }
        )
        expect(placements).toEqual(
            new Map([
                ["a", 5],
                ["c", 17],
            ])
        )
    })

    it("leaves no placed label further from its anchor than the cap", () => {
        const labels = [100, 101, 102, 103, 104, 105].map((anchorY, i) =>
            label(`l${i}`, anchorY)
        )
        const maxShift = 15
        const placements = placeEdgeLabels(labels, {
            range,
            gap: 2,
            maxShift,
        })

        const placedLabels = labels.filter((l) => placements.has(l.id))
        expect(placedLabels.length).toBeGreaterThan(0)
        expect(placedLabels.length).toBeLessThan(labels.length)
        for (const l of placedLabels) {
            expect(
                Math.abs(placements.get(l.id)! - l.anchorY)
            ).toBeLessThanOrEqual(maxShift + 0.01)
        }
    })

    it("equals fitting the budget and separating when the cap is infinite", () => {
        const labels = [label("a", 10), label("b", 12), label("c", 14)]
        const smallRange = { top: 0, bottom: 30 }
        const placements = placeEdgeLabels(labels, {
            range: smallRange,
            gap: 2,
            maxShift: Infinity,
        })
        const separated = separateLabelsNearAnchors(
            labels.slice(0, 2),
            smallRange,
            2
        )
        expect(placements).toEqual(
            new Map([
                ["a", separated.get("a")!],
                ["b", separated.get("b")!],
            ])
        )
    })
})
