import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import {
    Sankey,
    type SankeyNode,
} from "../../../../components/Sankey/Sankey.js"

describe("parallel link rendering", () => {
    const nodes = [
        { id: "source", label: "Source" },
        { id: "target", label: "Target" },
    ]
    const links = [
        { source: "source", target: "target", value: 1, category: "small" },
        { source: "source", target: "target", value: 9, category: "large" },
    ]

    it("preserves each link's color and low-volume fading by default", () => {
        const markup = renderToStaticMarkup(
            createElement(Sankey, {
                nodes,
                links,
                width: 600,
                height: 400,
                totalFlowVolume: 10,
                linkLowVolumeThreshold: 0.2,
                linkColor: (link) =>
                    link.category === "small" ? "red" : "blue",
            })
        )

        const paths = markup.match(/<path\b[^>]*>/g) ?? []
        expect(paths).toHaveLength(2)
        expect(paths[0]).toContain('fill="red"')
        expect(paths[0]).toContain("sankey__link--low-volume")
        expect(paths[1]).toContain('fill="blue"')
        expect(paths[1]).not.toContain("sankey__link--low-volume")
    })

    it("merges parallel links into a seamless ribbon when enabled", () => {
        const markup = renderToStaticMarkup(
            createElement(Sankey, {
                nodes,
                links,
                width: 600,
                height: 400,
                mergeParallelLinks: true,
                linkColor: () => "teal",
            })
        )

        const paths = markup.match(/<path\b[^>]*>/g) ?? []
        expect(paths).toHaveLength(1)
        expect(paths[0]).toContain('fill="teal"')
    })
})

/**
 * A node's label variants are tried in order, and the first that fits is
 * drawn. With `fitMiddleLabelsToRibbons`, a middle column's label only fits
 * where it lies entirely on the node's own ribbons on its side; where no
 * variant does, the node goes unlabelled. The variants here are the full
 * label, then the name without the value line, then the icon alone, by the
 * band.
 *
 * The rendering tests use four middle nodes: a thick ribbon with room for a
 * two-line label; two ribbons about 20px thick, with room for one line but
 * not two, one of them with a name too long to fit along its ribbon; and a
 * ribbon about 10px thick, too thin even for the 14px icon.
 */
const ICON = createElement("rect", { width: 16, height: 16 })

function renderLabels({
    fitMiddleLabelsToRibbons,
    isIconFirst = false,
}: {
    fitMiddleLabelsToRibbons: boolean
    /** Try the icon alone before the variants with text */
    isIconFirst?: boolean
}): { texts: string[]; iconCount: number } {
    const middle: [id: string, value: number, label: string][] = [
        ["wide", 200, "wide"],
        ["medium", 14, "medium"],
        ["long", 14, "a name far too long to lie along its ribbon at all"],
        ["narrow", 6, "narrow"],
    ]
    const nodes: SankeyNode[] = [
        { id: "from", label: "" },
        ...middle.map(([id, , label]) => {
            const icon = { icon: ICON, iconStyle: "inline" as const }
            const withText = [
                { label, valueLabel: "1 ha", ...icon },
                { label, ...icon },
            ]
            return {
                id,
                label,
                labelColor: "#333",
                labelVariants: isIconFirst
                    ? [icon, ...withText]
                    : [...withText, icon],
            }
        }),
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
    it("shows a label in full where it fits, its name alone where only that fits, then its icon alone, then nothing", () => {
        const { texts, iconCount } = renderLabels({
            fitMiddleLabelsToRibbons: true,
        })
        expect(texts).toEqual(["wide", "1 ha", "medium"])
        // The wide and medium nodes' icons lead their text; the long-named
        // node keeps only its icon; the narrow node has none
        expect(iconCount).toEqual(3)
    })

    it("leaves every label in place when fitting is off", () => {
        const { texts, iconCount } = renderLabels({
            fitMiddleLabelsToRibbons: false,
        })
        // (The narrow node is too short for its value line, as always)
        expect(texts).toEqual([
            "wide",
            "1 ha",
            "medium",
            "1 ha",
            "a name far too long to lie along its ribbon at all",
            "1 ha",
            "narrow",
        ])
        expect(iconCount).toEqual(4)
    })

    it("tries the variants in the order given", () => {
        const { texts, iconCount } = renderLabels({
            fitMiddleLabelsToRibbons: true,
            isIconFirst: true,
        })
        // Every node whose ribbon fits the icon shows it alone; on the narrow
        // node's ribbon nothing fits
        expect(texts).toEqual([])
        expect(iconCount).toEqual(3)
    })
})
