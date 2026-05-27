import { describe, it, expect } from "vitest"
import { sankey as d3Sankey } from "d3-sankey"

import { type FontSettings } from "@ourworldindata/grapher"

import {
    getSankeyVerticalLabelPadding,
    SankeyLink,
    SankeyNode,
} from "./Sankey.js"
import {
    computeHalfHeights,
    NON_STACKED_FONT_SETTINGS,
    SANKEY_NODE_PADDING,
    SankeyBuild,
} from "./SplitFlowSankey.js"

// All tests use this as the central entity. Mirrors `buildHalf`'s structure:
// partner nodes carry an "in:"/"out:" prefix to disambiguate same-name partners
// across the two halves; the central node is shared.
const CENTRAL = "X"

// Build a minimal half (n partners with the given values + the central node),
// shaped exactly like `buildHalf` so d3-sankey lays it out the same way.
function makeBuild({
    side,
    partnerValues,
}: {
    side: "incoming" | "outgoing"
    partnerValues: number[]
}): SankeyBuild {
    const isIncoming = side === "incoming"
    const prefix = isIncoming ? "in:" : "out:"
    const partners: SankeyNode[] = partnerValues.map((_, i) => ({
        id: `${prefix}p${i}`,
        label: `p${i}`,
    }))
    const links: SankeyLink[] = partnerValues.map((value, i) =>
        isIncoming
            ? { source: `${prefix}p${i}`, target: CENTRAL, value }
            : { source: CENTRAL, target: `${prefix}p${i}`, value }
    )
    const centralNode: SankeyNode = { id: CENTRAL, label: "" }
    const nodes = isIncoming
        ? [...partners, centralNode]
        : [centralNode, ...partners]
    return { nodes, links }
}

// Run d3-sankey on a build using the same options Sankey.tsx uses (extent,
// nodePadding, nodeSort, iterations) and return the realized value-to-pixel
// scale `ky`. ky is constant across all nodes in a layout, so we read it off
// the first node (its band height divided by its value).
function realizedKy({
    build,
    width,
    height,
    fontSettings,
}: {
    build: SankeyBuild
    width: number
    height: number
    fontSettings: FontSettings
}): number {
    const vlp = getSankeyVerticalLabelPadding(fontSettings)
    const generator = d3Sankey<SankeyNode, SankeyLink>()
        .nodeId((d) => d.id)
        .nodeWidth(7) // bandWidth (4) + bandFlowGap (3)
        .nodePadding(SANKEY_NODE_PADDING)
        .nodeSort(null)
        .extent([
            [0, vlp],
            [width, height - vlp],
        ])
        .iterations(0) // matches anchorNodeId set in SplitFlowSankey

    const result = generator({
        nodes: build.nodes.map((n) => ({ ...n })),
        links: build.links.map((l) => ({ ...l })),
    })
    const node = result.nodes[0]
    const y0 = node.y0 ?? 0
    const y1 = node.y1 ?? 0
    const value = node.value ?? 0
    return (y1 - y0) / value
}

const DEFAULT_WIDTH = 500
const DEFAULT_CHART_HEIGHT = 480

const defaultOpts = {
    chartHeight: DEFAULT_CHART_HEIGHT,
    isSingleHalf: false,
    central: CENTRAL,
    fontSettings: NON_STACKED_FONT_SETTINGS,
}

// Equal partner values summing to `total`.
function equalSplit(total: number, n: number): number[] {
    return Array.from({ length: n }, () => total / n)
}

describe("computeHalfHeights (side-by-side)", () => {
    it("yields the same ky when totals & partner counts match", () => {
        const incomingBuild = makeBuild({
            side: "incoming",
            partnerValues: equalSplit(100, 5),
        })
        const outgoingBuild = makeBuild({
            side: "outgoing",
            partnerValues: equalSplit(100, 5),
        })
        const h = computeHalfHeights({
            ...defaultOpts,
            isStacked: false,
            incomingBuild,
            outgoingBuild,
        })
        const kyIn = realizedKy({
            build: incomingBuild,
            width: DEFAULT_WIDTH,
            height: h.incoming,
            fontSettings: defaultOpts.fontSettings,
        })
        const kyOut = realizedKy({
            build: outgoingBuild,
            width: DEFAULT_WIDTH,
            height: h.outgoing,
            fontSettings: defaultOpts.fontSettings,
        })
        expect(kyIn).toBeCloseTo(kyOut, 6)
    })

    it("yields the same ky when partner counts differ (regression: padding-aware sizing)", () => {
        // Same total flow on both halves; the asymmetric partner count is
        // the case where the old buggy formula under-counted vertical margin
        // and made the shorter half ride a smaller ky.
        const incomingBuild = makeBuild({
            side: "incoming",
            partnerValues: equalSplit(100, 10),
        })
        const outgoingBuild = makeBuild({
            side: "outgoing",
            partnerValues: equalSplit(100, 3),
        })
        const h = computeHalfHeights({
            ...defaultOpts,
            isStacked: false,
            incomingBuild,
            outgoingBuild,
        })
        const kyIn = realizedKy({
            build: incomingBuild,
            width: DEFAULT_WIDTH,
            height: h.incoming,
            fontSettings: defaultOpts.fontSettings,
        })
        const kyOut = realizedKy({
            build: outgoingBuild,
            width: DEFAULT_WIDTH,
            height: h.outgoing,
            fontSettings: defaultOpts.fontSettings,
        })
        expect(kyIn).toBeCloseTo(kyOut, 6)
    })

    it("yields the same ky when totals differ", () => {
        const incomingBuild = makeBuild({
            side: "incoming",
            partnerValues: equalSplit(200, 5),
        })
        const outgoingBuild = makeBuild({
            side: "outgoing",
            partnerValues: equalSplit(50, 5),
        })
        const h = computeHalfHeights({
            ...defaultOpts,
            isStacked: false,
            incomingBuild,
            outgoingBuild,
        })
        const kyIn = realizedKy({
            build: incomingBuild,
            width: DEFAULT_WIDTH,
            height: h.incoming,
            fontSettings: defaultOpts.fontSettings,
        })
        const kyOut = realizedKy({
            build: outgoingBuild,
            width: DEFAULT_WIDTH,
            height: h.outgoing,
            fontSettings: defaultOpts.fontSettings,
        })
        expect(kyIn).toBeCloseTo(kyOut, 6)
    })

    it("yields the same ky when totals AND partner counts differ", () => {
        const incomingBuild = makeBuild({
            side: "incoming",
            partnerValues: [80, 5, 5, 5, 3, 2],
        })
        const outgoingBuild = makeBuild({
            side: "outgoing",
            partnerValues: [40, 8, 2],
        })
        const h = computeHalfHeights({
            ...defaultOpts,
            isStacked: false,
            incomingBuild,
            outgoingBuild,
        })
        const kyIn = realizedKy({
            build: incomingBuild,
            width: DEFAULT_WIDTH,
            height: h.incoming,
            fontSettings: defaultOpts.fontSettings,
        })
        const kyOut = realizedKy({
            build: outgoingBuild,
            width: DEFAULT_WIDTH,
            height: h.outgoing,
            fontSettings: defaultOpts.fontSettings,
        })
        expect(kyIn).toBeCloseTo(kyOut, 6)
    })

    it("the more constrained half fills the available chartHeight", () => {
        // Lots of partners on incoming → its padding overhead dominates,
        // making it the limiting side. Its height should hit chartHeight;
        // the outgoing half shrinks to maintain the same ky.
        const incomingBuild = makeBuild({
            side: "incoming",
            partnerValues: equalSplit(100, 12),
        })
        const outgoingBuild = makeBuild({
            side: "outgoing",
            partnerValues: equalSplit(20, 2),
        })
        const h = computeHalfHeights({
            ...defaultOpts,
            isStacked: false,
            incomingBuild,
            outgoingBuild,
        })
        expect(h.incoming).toBeCloseTo(DEFAULT_CHART_HEIGHT, 6)
        expect(h.outgoing).toBeLessThan(DEFAULT_CHART_HEIGHT)
    })
})

describe("computeHalfHeights (stacked)", () => {
    // Stacked mode uses smaller font settings. The fix made the per-cell
    // overhead font-aware, so the test mirrors what the real component does.
    const STACKED_FONT: FontSettings = {
        fontSize: 10.5,
        fontWeight: 400,
        lineHeight: 1,
    }
    const stackedOpts = { ...defaultOpts, fontSettings: STACKED_FONT }
    // In stacked mode each row is half of `chartHeight` in the component;
    // for the test we just plug the per-cell value directly.
    const STACKED_CELL_HEIGHT = 200

    it("yields the same ky across the two stacked halves", () => {
        const incomingBuild = makeBuild({
            side: "incoming",
            partnerValues: equalSplit(100, 8),
        })
        const outgoingBuild = makeBuild({
            side: "outgoing",
            partnerValues: equalSplit(60, 3),
        })
        const h = computeHalfHeights({
            ...stackedOpts,
            chartHeight: STACKED_CELL_HEIGHT,
            isStacked: true,
            incomingBuild,
            outgoingBuild,
        })
        const kyIn = realizedKy({
            build: incomingBuild,
            width: DEFAULT_WIDTH,
            height: h.incoming,
            fontSettings: STACKED_FONT,
        })
        const kyOut = realizedKy({
            build: outgoingBuild,
            width: DEFAULT_WIDTH,
            height: h.outgoing,
            fontSettings: STACKED_FONT,
        })
        expect(kyIn).toBeCloseTo(kyOut, 6)
    })

    it("the two stacked cells together fill the combined chart space exactly", () => {
        const incomingBuild = makeBuild({
            side: "incoming",
            partnerValues: equalSplit(100, 8),
        })
        const outgoingBuild = makeBuild({
            side: "outgoing",
            partnerValues: equalSplit(60, 3),
        })
        const h = computeHalfHeights({
            ...stackedOpts,
            chartHeight: STACKED_CELL_HEIGHT,
            isStacked: true,
            incomingBuild,
            outgoingBuild,
        })
        // Combined cell space == 2 * per-cell chartHeight (the stacked
        // formula's invariant: SVGs sit flush in the two grid rows with no
        // wasted space, unlike side-by-side where the shorter SVG just sits
        // shorter inside its equal-height cell).
        expect(h.incoming + h.outgoing).toBeCloseTo(2 * STACKED_CELL_HEIGHT, 6)
    })
})

describe("computeHalfHeights (font sensitivity)", () => {
    it("matching ky holds regardless of which font settings are in use", () => {
        const incomingBuild = makeBuild({
            side: "incoming",
            partnerValues: equalSplit(100, 6),
        })
        const outgoingBuild = makeBuild({
            side: "outgoing",
            partnerValues: equalSplit(50, 4),
        })
        const smaller: FontSettings = {
            fontSize: 8,
            fontWeight: 400,
            lineHeight: 1.2,
        }
        for (const fontSettings of [NON_STACKED_FONT_SETTINGS, smaller]) {
            const h = computeHalfHeights({
                ...defaultOpts,
                fontSettings,
                isStacked: false,
                incomingBuild,
                outgoingBuild,
            })
            const kyIn = realizedKy({
                build: incomingBuild,
                width: DEFAULT_WIDTH,
                height: h.incoming,
                fontSettings,
            })
            const kyOut = realizedKy({
                build: outgoingBuild,
                width: DEFAULT_WIDTH,
                height: h.outgoing,
                fontSettings,
            })
            expect(kyIn).toBeCloseTo(kyOut, 6)
        }
    })
})

describe("computeHalfHeights (degenerate cases)", () => {
    const someBuild = makeBuild({
        side: "incoming",
        partnerValues: equalSplit(100, 3),
    })

    it("returns chartHeight for both halves when one build is null", () => {
        expect(
            computeHalfHeights({
                ...defaultOpts,
                isStacked: false,
                incomingBuild: null,
                outgoingBuild: someBuild,
            })
        ).toEqual({
            incoming: DEFAULT_CHART_HEIGHT,
            outgoing: DEFAULT_CHART_HEIGHT,
        })
    })

    it("returns chartHeight for both halves when isSingleHalf", () => {
        expect(
            computeHalfHeights({
                ...defaultOpts,
                isStacked: false,
                isSingleHalf: true,
                incomingBuild: someBuild,
                outgoingBuild: someBuild,
            })
        ).toEqual({
            incoming: DEFAULT_CHART_HEIGHT,
            outgoing: DEFAULT_CHART_HEIGHT,
        })
    })

    it("returns chartHeight for both halves when a half has zero total flow", () => {
        const zeroBuild = makeBuild({
            side: "outgoing",
            partnerValues: [0, 0, 0],
        })
        expect(
            computeHalfHeights({
                ...defaultOpts,
                isStacked: false,
                incomingBuild: someBuild,
                outgoingBuild: zeroBuild,
            })
        ).toEqual({
            incoming: DEFAULT_CHART_HEIGHT,
            outgoing: DEFAULT_CHART_HEIGHT,
        })
    })
})
