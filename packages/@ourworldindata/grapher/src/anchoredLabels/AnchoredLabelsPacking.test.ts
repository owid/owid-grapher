import { describe, expect, it } from "vitest"

import { ColumnLabel, packColumn } from "./AnchoredLabelsPacking"

const range = { top: 0, bottom: 200 }

const label = (
    id: string,
    anchorY: number,
    weight: number = 1,
    height: number = 10
): ColumnLabel => ({ id, anchorY, height, weight })

describe(packColumn, () => {
    it("keeps labels on their anchors when nothing overlaps", () => {
        const positions = packColumn(
            [label("a", 40), label("b", 100), label("c", 160)],
            range,
            2
        )
        expect(positions.get("a")).toBeCloseTo(40)
        expect(positions.get("b")).toBeCloseTo(100)
        expect(positions.get("c")).toBeCloseTo(160)
    })

    it("splits the shift evenly between overlapping labels of equal weight", () => {
        const positions = packColumn([label("a", 50), label("b", 52)], range, 2)
        expect(positions.get("a")).toBeCloseTo(45)
        expect(positions.get("b")).toBeCloseTo(57)
    })

    it("moves a heavier label less than a lighter one", () => {
        const positions = packColumn(
            [label("a", 50, 3), label("b", 52, 1)],
            range,
            2
        )
        expect(positions.get("a")).toBeCloseTo(47.5)
        expect(positions.get("b")).toBeCloseTo(59.5)
    })

    it("orders labels by anchor and keeps the gap between neighbours", () => {
        const positions = packColumn(
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

    it("returns nothing for an empty column", () => {
        expect(packColumn([], range, 2).size).toBe(0)
    })

    it("keeps input order for labels with the same anchor", () => {
        const positions = packColumn([label("b", 50), label("a", 50)], range, 2)
        expect(positions.get("b")).toBeCloseTo(44)
        expect(positions.get("a")).toBeCloseTo(56)
    })

    it("pins a column taller than the range to its top", () => {
        const positions = packColumn(
            [label("a", 10), label("b", 12)],
            { top: 0, bottom: 15 },
            2
        )
        expect(positions.get("a")).toBeCloseTo(5)
        expect(positions.get("b")).toBeCloseTo(17)
    })

    it("clamps a column pressed against the range edges and keeps the gaps", () => {
        const top = packColumn(
            [label("a", 1), label("b", 2), label("c", 3)],
            range,
            2
        )
        expect(top.get("a")).toBeCloseTo(5)
        expect(top.get("b")).toBeCloseTo(17)
        expect(top.get("c")).toBeCloseTo(29)

        const bottom = packColumn(
            [label("a", 198), label("b", 199), label("c", 200)],
            range,
            2
        )
        expect(bottom.get("a")).toBeCloseTo(171)
        expect(bottom.get("b")).toBeCloseTo(183)
        expect(bottom.get("c")).toBeCloseTo(195)
    })
})
