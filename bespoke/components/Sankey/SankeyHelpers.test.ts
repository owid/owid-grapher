import { describe, it, expect } from "vitest"

import {
    DEFAULT_MAX_NODES,
    DEFAULT_MAX_NODES_TO_SHRINK_OTHER,
    DEFAULT_MIN_NODE_SHARE,
    Flow,
    selectTopEntities,
} from "./SankeyHelpers.js"

/**
 * Build incoming flows (partner → central) whose per-partner totals match the
 * given values. Partners are named P0, P1, … in descending value order.
 */
function flowsFromValues(values: number[]): Flow[] {
    return values.map((value, i) => ({
        source: `P${i}`,
        target: "central",
        value,
    }))
}

function select(
    values: number[],
    opts?: {
        maxNodes?: number
        maxNodesToShrinkOther?: number
        minNodeShare?: number
        showAllOtherBelow?: number
    }
) {
    return selectTopEntities({
        flows: flowsFromValues(values),
        side: "source",
        maxNodes: opts?.maxNodes ?? DEFAULT_MAX_NODES,
        maxNodesToShrinkOther: opts?.maxNodesToShrinkOther,
        minNodeShare: opts?.minNodeShare ?? DEFAULT_MIN_NODE_SHARE,
        showAllOtherBelow: opts?.showAllOtherBelow,
    })
}

const topEntities = (r: { top: { entity: string }[] }): string[] =>
    r.top.map((d) => d.entity)

const otherTotal = (r: { other: { total: number }[] }): number =>
    r.other.reduce((sum, d) => sum + d.total, 0)

const smallestShown = (r: { top: { total: number }[] }): number =>
    Math.min(...r.top.map((d) => d.total))

describe(selectTopEntities, () => {
    it("handles empty input", () => {
        const r = select([])
        expect(r.top).toEqual([])
        expect(r.other).toEqual([])
        expect(r.total).toBe(0)
    })

    it("shows all partners when there are few enough to fit under the ceiling", () => {
        const r = select([91, 9, 0.3])
        expect(topEntities(r)).toEqual(["P0", "P1", "P2"])
        expect(r.other).toEqual([])
    })

    it("shows a meaningful second node next to a dominant one", () => {
        const r = select([91, 9, ...Array(20).fill(0.05)])
        expect(topEntities(r)).toEqual(["P0", "P1"])
        expect(otherTotal(r)).toBeCloseTo(1)
    })

    it("folds sub-floor slivers into Other rather than showing them", () => {
        const r = select([88, 0.5, 0.5, 0.5, ...Array(20).fill(0.5)])
        expect(topEntities(r)).toEqual(["P0"])
        expect(otherTotal(r)).toBeGreaterThan(0)
    })

    it("caps a diffuse distribution at maxNodes", () => {
        // 12 equally-sized partners are all above the floor
        const r = select(Array(12).fill(10))
        expect(r.top.length).toBe(DEFAULT_MAX_NODES)
        expect(r.other.length).toBe(2)
    })

    it("climbs past maxNodes (up to maxNodesToShrinkOther) to shrink a big Other", () => {
        // 30 equal partners: the floor stops at the default budget of 10, but
        // "Other" (the remaining 20) dwarfs every shown node, so the invariant
        // is allowed to climb to the raised ceiling
        const r = select(Array(30).fill(10), { maxNodesToShrinkOther: 20 })
        expect(r.top.length).toBe(20)
    })

    it("stays at maxNodes when no raised ceiling is given", () => {
        // Same distribution, but without headroom the budget of 10 holds even
        // though "Other" remains large
        const r = select(Array(30).fill(10))
        expect(r.top.length).toBe(DEFAULT_MAX_NODES)
    })

    it("stops promoting once Other is a sub-floor sliver, even if not the smallest", () => {
        const r = select(
            [
                20, 18, 15, 12, 10, 8, 6, 4, 2, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4,
                0.3, 0.2,
            ],
            { maxNodesToShrinkOther: DEFAULT_MAX_NODES_TO_SHRINK_OTHER }
        )
        expect(r.top.length).toBe(14)
        expect(r.top.length).toBeLessThan(DEFAULT_MAX_NODES_TO_SHRINK_OTHER)
        expect(otherTotal(r)).toBeLessThan(DEFAULT_MIN_NODE_SHARE * r.total)
        expect(otherTotal(r)).toBeGreaterThan(smallestShown(r))
    })

    it("always keeps at least one node even if all are below the floor", () => {
        const r = select(Array(200).fill(1))
        expect(r.top.length).toBeGreaterThanOrEqual(1)
    })

    it("enforces the Other-is-smallest rule by promoting partners", () => {
        const r = select([89, 1, ...Array(20).fill(0.5)])
        expect(r.top.length).toBeGreaterThan(2)
        expect(
            otherTotal(r) <= smallestShown(r) ||
                r.top.length === DEFAULT_MAX_NODES
        ).toBe(true)
    })

    it("inlines a lone Other tail when showAllOtherBelow allows it", () => {
        const r = select(Array(11).fill(10), { showAllOtherBelow: 1 })
        expect(r.top.length).toBe(11)
        expect(r.other).toEqual([])
    })
})
