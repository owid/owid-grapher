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

    it("sorts labels by anchor and centers a crowded group on its anchors' mean", () => {
        // Anchors average 50.25, so the 36px-tall column is centered there
        const positions = separateLabelsNearAnchors(
            [label("c", 52), label("a", 48), label("b", 50), label("d", 51)],
            range,
            2
        )
        expect(positions.get("a")).toBeCloseTo(32.25)
        expect(positions.get("b")).toBeCloseTo(44.25)
        expect(positions.get("d")).toBeCloseTo(56.25)
        expect(positions.get("c")).toBeCloseTo(68.25)
    })

    it("puts the earlier label on top when two share an anchor", () => {
        const positions = separateLabelsNearAnchors(
            [label("b", 50), label("a", 50)],
            range,
            2
        )
        expect(positions.get("b")).toBeCloseTo(44)
        expect(positions.get("a")).toBeCloseTo(56)
    })

    it("pushes a group pressed against the range's top or bottom back inside", () => {
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
    const threeStackedLabels = [label("a", 5), label("b", 17), label("c", 29)]

    it("leaves out the lowest-priority label when the labels overflow the range", () => {
        // Three 10px labels 2px apart need 34px
        const placements = placeEdgeLabels(threeStackedLabels, {
            range: { top: 0, bottom: 30 },
            gap: 2,
            maxShift: Infinity,
        })
        expect(placements).toEqual(
            new Map([
                ["a", 5],
                ["b", 17],
            ])
        )
    })

    it("keeps every label when they fill the range exactly", () => {
        const placements = placeEdgeLabels(threeStackedLabels, {
            range: { top: 0, bottom: 34 },
            gap: 2,
            maxShift: Infinity,
        })
        expect(placements).toEqual(
            new Map([
                ["a", 5],
                ["b", 17],
                ["c", 29],
            ])
        )
    })

    it.each([
        // Separated, they sit at 92, 104, 116, so x moves up 8
        { direction: "up", lowestPriorityAnchorY: 112 },
        // Separated, they sit at 84, 96, 108, so y moves down 8
        { direction: "down", lowestPriorityAnchorY: 88 },
    ])(
        "leaves out a label that would push a kept label $direction by more than maxShift",
        ({ lowestPriorityAnchorY }) => {
            const placements = placeEdgeLabels(
                [
                    label("x", 100),
                    label("y", 100),
                    label("z", lowestPriorityAnchorY),
                ],
                { range, gap: 2, maxShift: 6 }
            )
            expect(placements).toEqual(
                new Map([
                    ["x", 94],
                    ["y", 106],
                ])
            )
        }
    )

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

    it("spends the range's height only on labels it keeps", () => {
        // The range fits two labels; b, pushed 12px off its shared anchor
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
})
