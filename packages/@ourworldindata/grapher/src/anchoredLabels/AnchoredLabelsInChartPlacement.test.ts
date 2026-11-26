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

    it("moves a label down when moving up would leave the range", () => {
        // Clearing the strip takes 3px up but would push the label's top
        // above the range, so it moves 9px down instead
        const toAvoid = new Bounds(0, 9.5, 20, 1)
        const offsetYs = placeInChartLabels([label("a", 2, [toAvoid])], {
            range,
            maxShift: 10,
        })
        expect(offsetYs.get("a")).toBe(9)
    })

    it("keeps a label clear of labels placed before it", () => {
        const offsetYs = placeInChartLabels([label("a", 40), label("b", 45)], {
            range,
            maxShift: 10,
        })
        expect(offsetYs.get("a")).toBe(0)
        expect(offsetYs.get("b")).toBe(5.5)
    })

    it("keeps a label clear of an earlier label at its shifted position", () => {
        // a moves up from 40–50 to 34–44, onto b at 28–38, which then moves up too
        const toAvoid = new Bounds(0, 44.5, 20, 1)
        const offsetYs = placeInChartLabels(
            [label("a", 40, [toAvoid]), label("b", 28)],
            { range, maxShift: 10 }
        )
        expect(offsetYs).toEqual(
            new Map([
                ["a", -6],
                ["b", -4.5],
            ])
        )
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

    it("places a label that needs exactly maxShift and leaves out one that needs more", () => {
        // b, on top of a, clears it 10.5px up
        const place = (maxShift: number): Map<string, number> =>
            placeInChartLabels([label("a", 40), label("b", 40)], {
                range,
                maxShift,
            })
        expect(place(10.5)).toEqual(
            new Map([
                ["a", 0],
                ["b", -10.5],
            ])
        )
        expect(place(10)).toEqual(new Map([["a", 0]]))
    })
})
