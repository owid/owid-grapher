/**
 * `isBoxCoveredByRibbons` decides whether a middle label fits on its ribbons:
 * at every x across the label's box, the box's whole height must lie inside
 * the ribbons' combined thickness. The Sankey's fallbacks for labels that
 * don't fit are tested where it is rendered, in the deforestation project.
 */
import { describe, expect, it } from "vitest"

import { Bounds } from "@ourworldindata/utils"
import { isBoxCoveredByRibbons, type RibbonGeometry } from "./Sankey.js"

describe(isBoxCoveredByRibbons, () => {
    /** A horizontal ribbon from x = 0 to 100, centred at `y` */
    const straight = (y: number, width: number): RibbonGeometry => ({
        x0: 0,
        x1: 100,
        y0: y,
        y1: y,
        width,
    })
    const box = new Bounds(40, 10, 20, 12) // spans y = 10 to 22

    it("covers a box well inside one ribbon", () => {
        expect(isBoxCoveredByRibbons(box, [straight(16, 20)])).toBe(true)
    })

    it("doesn't cover a box that reaches its ribbon's edge, leaving no padding", () => {
        expect(isBoxCoveredByRibbons(box, [straight(16, 12)])).toBe(false)
    })

    it("covers a box across two ribbons stacked edge to edge", () => {
        // y = 4 to 16 and 16 to 28
        expect(
            isBoxCoveredByRibbons(box, [straight(10, 12), straight(22, 12)])
        ).toBe(true)
    })

    it("doesn't cover a box over a gap between two ribbons", () => {
        // y = 4 to 15 and 17 to 28
        expect(
            isBoxCoveredByRibbons(box, [straight(9.5, 11), straight(22.5, 11)])
        ).toBe(false)
    })

    it("doesn't cover a box that runs past the end of its ribbon", () => {
        const shortRibbon = { ...straight(16, 20), x1: 50 }
        expect(isBoxCoveredByRibbons(box, [shortRibbon])).toBe(false)
    })

    it("doesn't cover a box that a curving ribbon drops away from", () => {
        // Centred at y = 16 on the left, curving down to y = 60 on the right
        const curving = { x0: 0, x1: 100, y0: 16, y1: 60, width: 20 }
        expect(isBoxCoveredByRibbons(box, [curving])).toBe(false)
    })
})
