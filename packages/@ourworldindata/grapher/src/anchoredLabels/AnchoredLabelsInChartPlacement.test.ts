import { describe, expect, it } from "vitest"
import { Bounds } from "@ourworldindata/utils"
import {
    InChartLabelToPlace,
    placeInChartLabels,
} from "./AnchoredLabelsInChartPlacement.js"

const range = { top: 0, bottom: 100 }

const label = (
    id: string,
    y: number,
    boundsToAvoid: Bounds[] = [],
    x = 0
): InChartLabelToPlace => {
    const bounds = new Bounds(x, y, 20, 10)
    return { id, bounds, collisionBounds: bounds, boundsToAvoid }
}

describe(placeInChartLabels, () => {
    it("leaves a label without collisions in place", () => {
        const offsetYs = placeInChartLabels([label("a", 40)], {
            range,
            maxShift: 10,
        })
        expect(offsetYs).toEqual(new Map([["a", 0]]))
    })

    it("tries up before down at the same distance", () => {
        // A 1px strip to avoid in the middle of the label clears either way after 6px
        const toAvoid = new Bounds(0, 44.5, 20, 1)
        const offsetYs = placeInChartLabels([label("a", 40, [toAvoid])], {
            range,
            maxShift: 10,
        })
        expect(offsetYs.get("a")).toBe(-6)
    })

    it("keeps labels inside the range", () => {
        // Up is blocked by the range top, so the label moves down
        const toAvoid = new Bounds(0, 2.5, 20, 1)
        const offsetYs = placeInChartLabels([label("a", 0, [toAvoid])], {
            range,
            maxShift: 10,
        })
        expect(offsetYs.get("a")).toBe(4)
    })

    it("avoids labels placed earlier", () => {
        const offsetYs = placeInChartLabels([label("a", 40), label("b", 45)], {
            range,
            maxShift: 10,
        })
        expect(offsetYs.get("a")).toBe(0)
        expect(offsetYs.get("b")).toBe(5.5)
    })

    it("ignores earlier labels that don't overlap horizontally", () => {
        const offsetYs = placeInChartLabels(
            [label("a", 40), label("b", 40, [], 50)],
            { range, maxShift: 10 }
        )
        expect(offsetYs).toEqual(
            new Map([
                ["a", 0],
                ["b", 0],
            ])
        )
    })

    it("leaves out a label with no free y offset within maxShift", () => {
        const offsetYs = placeInChartLabels([label("a", 40), label("b", 40)], {
            range,
            maxShift: 5,
        })
        expect(offsetYs).toEqual(new Map([["a", 0]]))
    })
})
