import { describe, it, expect } from "vitest"
import { sankey as d3Sankey } from "d3-sankey"

import { type FontSettings } from "@ourworldindata/grapher"

import {
    getSankeyVerticalLabelPadding,
    SankeyLink,
    SankeyNode,
} from "./Sankey.js"
import {
    computeChartHeight,
    computeHalfHeights,
    DEFAULT_FONT_SETTINGS,
    HEADING_CHART_GAP,
    HEADING_HEIGHT,
    SANKEY_NODE_PADDING,
    SankeyHalfBuild,
    selectTopEntities,
    STACKED_VERTICAL_PADDING,
} from "./SplitFlowSankey.js"
import {
    DEFAULT_MAX_NODES,
    DEFAULT_MIN_NODE_SHARE,
    Flow,
} from "./SankeyHelpers.js"

const CENTRAL_NODE_NAME = "centralNode"

function makeBuild({
    side,
    partnerValues,
}: {
    side: "incoming" | "outgoing"
    partnerValues: number[]
}): SankeyHalfBuild {
    const isIncoming = side === "incoming"
    const prefix = isIncoming ? "in:" : "out:"
    const partners: SankeyNode[] = partnerValues.map((_, i) => ({
        id: `${prefix}p${i}`,
        label: `p${i}`,
    }))
    const links: SankeyLink[] = partnerValues.map((value, i) =>
        isIncoming
            ? { source: `${prefix}p${i}`, target: CENTRAL_NODE_NAME, value }
            : { source: CENTRAL_NODE_NAME, target: `${prefix}p${i}`, value }
    )
    const centralNode: SankeyNode = { id: CENTRAL_NODE_NAME, label: "" }
    const nodes = isIncoming
        ? [...partners, centralNode]
        : [centralNode, ...partners]
    return { nodes, links }
}

// Mirror Sankey.tsx layout options and read realized value-to-pixel scale (ky).
function realizedKy({
    build,
    width,
    height,
    fontSettings,
}: {
    build: SankeyHalfBuild
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
    centralEntity: CENTRAL_NODE_NAME,
    fontSettings: DEFAULT_FONT_SETTINGS,
}

function equalSplit(total: number, n: number): number[] {
    return Array.from({ length: n }, () => total / n)
}

describe("computeChartHeight (heading-aware chart space)", () => {
    it("subtracts the taller shown heading + row gap (side-by-side)", () => {
        expect(
            computeChartHeight({
                height: 500,
                isStacked: false,
                headingHeights: [20, 36],
            })
        ).toBe(500 - 36 - HEADING_CHART_GAP)
    })

    it("uses the single shown heading in single-half view", () => {
        expect(
            computeChartHeight({
                height: 500,
                isStacked: false,
                headingHeights: [18],
            })
        ).toBe(500 - 18 - HEADING_CHART_GAP)
    })

    it("falls back to HEADING_HEIGHT for unmeasured headings", () => {
        expect(
            computeChartHeight({
                height: 500,
                isStacked: false,
                headingHeights: [undefined, undefined],
            })
        ).toBe(500 - HEADING_HEIGHT - HEADING_CHART_GAP)
    })

    it("returns height minus gap when no headings are shown", () => {
        expect(
            computeChartHeight({
                height: 500,
                isStacked: false,
                headingHeights: [],
            })
        ).toBe(500 - HEADING_CHART_GAP)
    })

    it("subtracts both headings + padding then halves (stacked)", () => {
        const result = computeChartHeight({
            height: 500,
            isStacked: true,
            headingHeights: [20, 30],
        })
        expect(result).toBe((500 - 20 - 30 - STACKED_VERTICAL_PADDING) / 2)
        expect(2 * result).toBe(500 - 20 - 30 - STACKED_VERTICAL_PADDING)
    })

    it("mixes measured and fallback heading heights (stacked)", () => {
        expect(
            computeChartHeight({
                height: 500,
                isStacked: true,
                headingHeights: [undefined, 30],
            })
        ).toBe((500 - HEADING_HEIGHT - 30 - STACKED_VERTICAL_PADDING) / 2)
    })

    it("clamps to 0 when headings exceed the available height", () => {
        expect(
            computeChartHeight({
                height: 10,
                isStacked: false,
                headingHeights: [40],
            })
        ).toBe(0)
    })
})

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
        // Regression case: equal totals, asymmetric partner counts.
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

    it("keeps each non-degenerate half within (0, chartHeight]", () => {
        const incomingBuild = makeBuild({
            side: "incoming",
            partnerValues: [60, 20, 10, 10],
        })
        const outgoingBuild = makeBuild({
            side: "outgoing",
            partnerValues: [30, 12, 5, 3],
        })
        const h = computeHalfHeights({
            ...defaultOpts,
            isStacked: false,
            incomingBuild,
            outgoingBuild,
        })

        expect(h.incoming).toBeGreaterThan(0)
        expect(h.outgoing).toBeGreaterThan(0)
        expect(h.incoming).toBeLessThanOrEqual(DEFAULT_CHART_HEIGHT)
        expect(h.outgoing).toBeLessThanOrEqual(DEFAULT_CHART_HEIGHT)
        expect(Math.max(h.incoming, h.outgoing)).toBeCloseTo(
            DEFAULT_CHART_HEIGHT,
            6
        )
    })

    it("is symmetric when incoming/outgoing distributions are swapped", () => {
        const incomingA = [80, 5, 5, 5, 3, 2]
        const outgoingB = [40, 8, 2]

        const hAB = computeHalfHeights({
            ...defaultOpts,
            isStacked: false,
            incomingBuild: makeBuild({
                side: "incoming",
                partnerValues: incomingA,
            }),
            outgoingBuild: makeBuild({
                side: "outgoing",
                partnerValues: outgoingB,
            }),
        })

        const hBA = computeHalfHeights({
            ...defaultOpts,
            isStacked: false,
            incomingBuild: makeBuild({
                side: "incoming",
                partnerValues: outgoingB,
            }),
            outgoingBuild: makeBuild({
                side: "outgoing",
                partnerValues: incomingA,
            }),
        })

        expect(hAB.incoming).toBeCloseTo(hBA.outgoing, 6)
        expect(hAB.outgoing).toBeCloseTo(hBA.incoming, 6)
    })
})

describe("computeHalfHeights (stacked)", () => {
    const STACKED_FONT: FontSettings = {
        fontSize: 10.5,
        fontWeight: 400,
        lineHeight: 1,
    }
    const stackedOpts = { ...defaultOpts, fontSettings: STACKED_FONT }
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
        expect(h.incoming + h.outgoing).toBeCloseTo(2 * STACKED_CELL_HEIGHT, 6)
    })

    it("preserves combined-space invariant for asymmetric totals and counts", () => {
        const incomingBuild = makeBuild({
            side: "incoming",
            partnerValues: [80, 5, 5, 5, 3, 2],
        })
        const outgoingBuild = makeBuild({
            side: "outgoing",
            partnerValues: [12, 8],
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
        for (const fontSettings of [DEFAULT_FONT_SETTINGS, smaller]) {
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

    it("matching ky also holds in stacked mode across fonts", () => {
        const incomingBuild = makeBuild({
            side: "incoming",
            partnerValues: [60, 20, 10, 10],
        })
        const outgoingBuild = makeBuild({
            side: "outgoing",
            partnerValues: [25, 15, 10],
        })

        for (const fontSettings of [
            DEFAULT_FONT_SETTINGS,
            {
                fontSize: 8,
                fontWeight: 400,
                lineHeight: 1.2,
            } as FontSettings,
        ]) {
            const chartHeight = 180
            const h = computeHalfHeights({
                ...defaultOpts,
                chartHeight,
                fontSettings,
                isStacked: true,
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
            expect(h.incoming + h.outgoing).toBeCloseTo(2 * chartHeight, 6)
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
                incomingBuild: undefined,
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

    it("returns chartHeight for both halves when stacked ky would be non-positive", () => {
        const crowdedIn = makeBuild({
            side: "incoming",
            partnerValues: equalSplit(10, 20),
        })
        const crowdedOut = makeBuild({
            side: "outgoing",
            partnerValues: equalSplit(10, 20),
        })

        const chartHeight = 80
        expect(
            computeHalfHeights({
                ...defaultOpts,
                chartHeight,
                isStacked: true,
                incomingBuild: crowdedIn,
                outgoingBuild: crowdedOut,
            })
        ).toEqual({
            incoming: chartHeight,
            outgoing: chartHeight,
        })
    })
})

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
        // Needs headroom above the default node budget to exercise promotion
        const ceiling = 15
        const r = select(
            [
                20, 18, 15, 12, 10, 8, 6, 4, 2, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4,
                0.3, 0.2,
            ],
            { maxNodesToShrinkOther: ceiling }
        )
        expect(r.top.length).toBe(14)
        expect(r.top.length).toBeLessThan(ceiling)
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
