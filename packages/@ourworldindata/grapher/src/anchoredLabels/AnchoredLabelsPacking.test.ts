import { describe, expect, it } from "vitest"

import {
    ColumnLabel,
    ColumnPlacement,
    packColumn,
    placeColumn,
} from "./AnchoredLabelsPacking"

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

describe(placeColumn, () => {
    const placed = (y: number): { kind: "placed"; y: number } => ({
        kind: "placed",
        y,
    })
    const hidden = (
        reason: "budget" | "too-far"
    ): { kind: "hidden"; reason: "budget" | "too-far" } => ({
        kind: "hidden",
        reason,
    })

    it("hides the lowest-priority labels that exceed the height budget", () => {
        const placements = placeColumn(
            [label("a", 5), label("b", 17), label("c", 29)],
            { range: { top: 0, bottom: 30 }, gap: 2, maxShift: Infinity }
        )
        expect(placements).toEqual(
            new Map<string, ColumnPlacement>([
                ["a", placed(5)],
                ["b", placed(17)],
                ["c", hidden("budget")],
            ])
        )
    })

    it("drops the lowest-priority label in the group of the worst violator", () => {
        // Packed together they sit at 92, 104, 116, so only x moves more than 6
        const placements = placeColumn(
            [label("x", 100), label("y", 100), label("z", 112)],
            { range, gap: 2, maxShift: 6 }
        )
        expect(placements).toEqual(
            new Map<string, ColumnPlacement>([
                ["x", placed(94)],
                ["y", placed(106)],
                ["z", hidden("too-far")],
            ])
        )
    })

    it("keeps a column that fills the height budget exactly", () => {
        const placements = placeColumn(
            [label("a", 5), label("b", 17), label("c", 29)],
            { range: { top: 0, bottom: 34 }, gap: 2, maxShift: Infinity }
        )
        expect(placements).toEqual(
            new Map<string, ColumnPlacement>([
                ["a", placed(5)],
                ["b", placed(17)],
                ["c", placed(29)],
            ])
        )
    })

    it("looks above the worst violator for the label to drop", () => {
        // Packed together they sit at 84, 96, 108, so only y, at the bottom, moves more than 6
        const placements = placeColumn(
            [label("x", 100), label("y", 100), label("z", 88)],
            { range, gap: 2, maxShift: 6 }
        )
        expect(placements).toEqual(
            new Map<string, ColumnPlacement>([
                ["x", placed(94)],
                ["y", placed(106)],
                ["z", hidden("too-far")],
            ])
        )
    })

    it("leaves no placed label further from its anchor than the cap", () => {
        const labels = [100, 101, 102, 103, 104, 105].map((anchorY, i) =>
            label(`l${i}`, anchorY)
        )
        const maxShift = 15
        const placements = placeColumn(labels, { range, gap: 2, maxShift })

        const placedLabels = labels.filter(
            (l) => placements.get(l.id)!.kind === "placed"
        )
        expect(placedLabels.length).toBeGreaterThan(0)
        expect(placedLabels.length).toBeLessThan(labels.length)
        for (const l of placedLabels) {
            const placement = placements.get(l.id)!
            if (placement.kind !== "placed") throw new Error("unreachable")
            expect(Math.abs(placement.y - l.anchorY)).toBeLessThanOrEqual(
                maxShift + 0.01
            )
        }
    })

    it("equals fitting the budget and packing when the cap is infinite", () => {
        const labels = [label("a", 10), label("b", 12), label("c", 14)]
        const smallRange = { top: 0, bottom: 30 }
        const placements = placeColumn(labels, {
            range: smallRange,
            gap: 2,
            maxShift: Infinity,
        })
        const packed = packColumn(labels.slice(0, 2), smallRange, 2)
        expect(placements).toEqual(
            new Map<string, ColumnPlacement>([
                ["a", placed(packed.get("a")!)],
                ["b", placed(packed.get("b")!)],
                ["c", hidden("budget")],
            ])
        )
    })
})
