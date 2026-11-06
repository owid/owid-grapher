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
 * drawn. A middle column's label only fits
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
    isIconFirst = false,
    iconStyle = "inline",
}: {
    /** Try the icon alone before the variants with text */
    isIconFirst?: boolean
    iconStyle?: "inline" | "badge"
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
            const icon = { icon: ICON, iconStyle }
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
        const { texts, iconCount } = renderLabels({})
        expect(texts).toEqual(["wide", "1 ha", "medium"])
        // The wide and medium nodes' icons lead their text; the long-named
        // node keeps only its icon; the narrow node has none
        expect(iconCount).toEqual(3)
    })

    it("also hides standalone badges where the ribbon is too thin", () => {
        const { texts, iconCount } = renderLabels({
            isIconFirst: true,
            iconStyle: "badge",
        })
        expect(texts).toEqual([])
        expect(iconCount).toEqual(3)
    })

    it("tries the variants in the order given", () => {
        const { texts, iconCount } = renderLabels({
            isIconFirst: true,
        })
        // Every node whose ribbon fits the icon shows it alone; on the narrow
        // node's ribbon nothing fits
        expect(texts).toEqual([])
        expect(iconCount).toEqual(3)
    })
})

// Middle bands must meet the rendered ribbons: the default overlaps to hide
// seams, while an explicitly narrow band leaves the requested gap on each side.
describe("middle-band ribbon endpoints", () => {
    it.each([
        { name: "default overlap", middleBand: undefined, gap: -0.5 },
        { name: "narrow band", middleBand: { width: 4, gap: 1 }, gap: 1 },
    ])("preserves the $name on both sides", ({ middleBand, gap }) => {
        const markup = renderToStaticMarkup(
            createElement(Sankey, {
                nodes: ["source", "middle", "target"].map((id) => ({
                    id,
                    label: "",
                })),
                links: [
                    { source: "source", target: "middle", value: 1 },
                    { source: "middle", target: "target", value: 1 },
                ],
                width: 600,
                height: 400,
                middleBand,
            })
        )
        const bands = markup.match(/<rect\b[^>]*>/g) ?? []
        expect(bands).toHaveLength(3)
        const middleX = Number(bands[1].match(/\bx="([^"]+)"/)?.[1])
        const middleWidth = Number(bands[1].match(/\bwidth="([^"]+)"/)?.[1])
        const paths = [...markup.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map(
            (match) => match[1]
        )
        expect(paths).toHaveLength(2)
        const incomingEndX = Number(paths[0].match(/L([^,]+),/)?.[1])
        const outgoingStartX = Number(paths[1].match(/^M([^,]+),/)?.[1])
        expect(middleX - incomingEndX).toBeCloseTo(gap)
        expect(outgoingStartX - (middleX + middleWidth)).toBeCloseTo(gap)
    })
})
