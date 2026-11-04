/**
 * With `fitMiddleLabelsToRibbons`, a middle column's label is only drawn where
 * it lies entirely on the node's own ribbons on its side. Where it doesn't,
 * the label falls back to its icon alone, by the band, if that fits; and
 * where not even the icon fits, the node goes unlabelled.
 *
 * The rendering tests use three middle nodes whose ribbons are about 330px,
 * 23px and 10px thick: room for a two-line label, for a 14px icon but not the
 * label's two lines, and for neither.
 */
import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { Bounds } from "@ourworldindata/utils"
import {
    isBoxCoveredByRibbons,
    Sankey,
    type RibbonGeometry,
    type SankeyNode,
} from "./Sankey.js"

const ICON = createElement("rect", { width: 16, height: 16 })

function renderLabels({
    fitMiddleLabelsToRibbons,
}: {
    fitMiddleLabelsToRibbons: boolean
}): { texts: string[]; iconCount: number } {
    const middle: [id: string, value: number][] = [
        ["wide", 200],
        ["medium", 14],
        ["narrow", 6],
    ]
    const nodes: SankeyNode[] = [
        { id: "from", label: "" },
        ...middle.map(([id]) => ({
            id,
            label: id,
            valueLabel: "1 ha",
            icon: ICON,
            iconStyle: "inline" as const,
        })),
        { id: "to", label: "" },
    ]
    const links = middle.flatMap(([id, value]) => [
        { source: "from", target: id, value },
        { source: id, target: "to", value },
    ])
    const markup = renderToStaticMarkup(
        createElement(Sankey, {
            nodes,
            links,
            width: 600,
            height: 400,
            middleLabelSide: "left",
            fitMiddleLabelsToRibbons,
        })
    )
    const texts = [...markup.matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)].map(
        (m) => m[1]
    )
    const iconCount = markup.match(/class="sankey__label-icon"/g)?.length ?? 0
    return { texts, iconCount }
}

describe("fitting middle labels to their ribbons", () => {
    it("shows a label in full where it fits on its ribbons, its icon alone where only that fits, and nothing where neither does", () => {
        const { texts, iconCount } = renderLabels({
            fitMiddleLabelsToRibbons: true,
        })
        expect(texts).toEqual(["wide", "1 ha"])
        // The wide node's icon leads its label; the medium node keeps only its
        // icon; the narrow node has none
        expect(iconCount).toEqual(2)
    })

    it("leaves every label in place when fitting is off", () => {
        const { texts, iconCount } = renderLabels({
            fitMiddleLabelsToRibbons: false,
        })
        // (The narrow node is too short for its value line, as always)
        expect(texts).toEqual(["wide", "1 ha", "medium", "1 ha", "narrow"])
        expect(iconCount).toEqual(3)
    })
})

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
