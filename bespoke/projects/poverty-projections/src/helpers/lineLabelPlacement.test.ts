import { describe, expect, it } from "vitest"

import { placeLineLabels } from "./lineLabelPlacement.js"

const item = (id: string, idealY: number, height = 12) => ({
    id,
    idealY,
    height,
})

describe(placeLineLabels, () => {
    it("keeps non-overlapping labels at their ideal positions", () => {
        const positions = placeLineLabels(
            [item("a", 20), item("b", 100), item("c", 200)],
            { top: 0, bottom: 300 }
        )
        expect(positions.get("a")).toBe(20)
        expect(positions.get("b")).toBe(100)
        expect(positions.get("c")).toBe(200)
    })

    it("pushes overlapping labels apart while preserving their order", () => {
        const positions = placeLineLabels(
            [item("a", 100), item("b", 102), item("c", 104)],
            { top: 0, bottom: 300, gap: 4 }
        )
        const a = positions.get("a")!
        const b = positions.get("b")!
        const c = positions.get("c")!
        expect(a).toBeLessThan(b)
        expect(b).toBeLessThan(c)
        expect(b - a).toBeGreaterThanOrEqual(16)
        expect(c - b).toBeGreaterThanOrEqual(16)
    })

    it("respects the bottom bound", () => {
        const positions = placeLineLabels(
            [item("a", 290), item("b", 295), item("c", 298)],
            { top: 0, bottom: 300, gap: 4 }
        )
        const c = positions.get("c")!
        expect(c + 6).toBeLessThanOrEqual(300)
        expect(positions.get("a")!).toBeLessThan(positions.get("b")!)
        expect(positions.get("b")!).toBeLessThan(c)
    })

    it("respects the top bound", () => {
        const positions = placeLineLabels([item("a", -20), item("b", 0)], {
            top: 0,
            bottom: 300,
            gap: 4,
        })
        expect(positions.get("a")!).toBeGreaterThanOrEqual(6)
    })

    it("accounts for multi-line label heights", () => {
        const positions = placeLineLabels(
            [item("a", 100, 24), item("b", 100, 36)],
            { top: 0, bottom: 300, gap: 4 }
        )
        const a = positions.get("a")!
        const b = positions.get("b")!
        // Centers must be at least half of both heights plus the gap apart
        expect(b - a).toBeGreaterThanOrEqual(24 / 2 + 36 / 2 + 4)
    })
})
