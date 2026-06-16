import { useCallback, useMemo, useRef, useState } from "react"
import cx from "classnames"
import * as R from "remeda"

import { type FontSettings } from "@ourworldindata/grapher"

import {
    BAND_LABEL_GAP,
    getSankeyVerticalLabelPadding,
    LinkSide,
    LinkTooltipArgs,
    measureMaxLabelWidthForNode,
    NodeTooltipArgs,
    Sankey,
    SankeyLink,
    SankeyNode,
    SankeyTooltip,
} from "./Sankey.js"
import {
    aggregateBySide,
    assignColors,
    DEFAULT_MAX_NODES,
    DEFAULT_MAX_NODES_TO_SHRINK_OTHER,
    DEFAULT_MIN_NODE_SHARE,
    getEntityShortLabel,
    EntityTotal,
    Flow,
    makeValueLabel,
    NEUTRAL_COLOR,
    OTHER_KEY,
} from "./SankeyHelpers.js"

/**
 * First-paint fallback for a heading's height, used only until the real
 * heading height has been measured from the DOM (see `useMeasuredHeight`)
 * Sized for the worst case where one heading wraps to two lines.
 */
export const HEADING_HEIGHT = 36

/**
 * Horizontal gap between the two halves of the Sankey chart
 * Must match the SCSS `gap` between the two halves.
 */
const SANKEY_HALVES_GAP = 16

/** Below this width the two halves stack vertically */
export const MOBILE_BREAKPOINT = 500

/** Font for node labels at normal (side-by-side) layout */
export const DEFAULT_FONT_SETTINGS: FontSettings = {
    fontSize: 12,
    fontWeight: 400,
    lineHeight: 1,
}

/** Shrunk font for node labels when the two halves are stacked on narrow containers */
export const MOBILE_FONT_SETTINGS: FontSettings = {
    fontSize: 10.5,
    fontWeight: 400,
    lineHeight: 1,
}

/** Vertical gap between nodes within a Sankey column */
export const SANKEY_NODE_PADDING = 12

/** Vertical space the stacked sankey charts */
export const STACKED_VERTICAL_PADDING = 16

/**
 * Gap between the heading row and the chart row in side-by-side and
 * single-half layouts. Must match `row-gap` in SplitFlowSankey.scss.
 */
export const HEADING_CHART_GAP = 4

type View = "both" | "incoming" | "outgoing"

export type SankeyHalfHeading = {
    label: React.ReactNode
    annotation?: string
    arrowSide?: "start" | "end"
}

type SankeyHalf = {
    rows: Flow[]
    heading: SankeyHalfHeading
    empty?: React.ReactNode
    getTooltip?: (args: SankeyHalfTooltipArgs) => SankeyTooltip | undefined
}

export type SankeyHalfTooltipArgs = {
    partner: string
    value: number
    /** Per-entity breakdown of the "Other" bucket */
    otherBreakdown?: EntityTotal[]
}

export type SankeyHalfBuild = {
    nodes: SankeyNode[]
    links: SankeyLink[]
    /** Entities folded into this half's Other bucket */
    otherBreakdown?: EntityTotal[]
}

interface SplitFlowSankeyProps {
    centralEntity: string
    /** Flows arriving at the central entity (target must equal `central`) */
    incoming: SankeyHalf
    /** Flows leaving the central entity (source must equal `central`) */
    outgoing: SankeyHalf
    width: number
    height: number
    /** Which halves to show. Single-half view takes the full width. */
    view?: View
    /** Stack the two halves vertically instead of side-by-side */
    isStacked?: boolean
    /** Font for node labels */
    fontSettings?: FontSettings
    /** How many significant partners to show per half by default */
    maxNodes?: number
    /** Raised ceiling used to shrink an oversized "Other" bucket */
    maxNodesToShrinkOther?: number
    minNodeShare?: number
    formatValue: (v: number) => string
    /**
     * If provided, used directly as the partner → color map — lets
     * callers stabilize colors across data slices that would otherwise
     * reorder partners by value (e.g. a time slider). When omitted, a
     * color map is derived from the currently displayed nodes.
     */
    colorMap?: Map<string, string>
}

export function SplitFlowSankey({
    incoming,
    outgoing,
    centralEntity,
    width,
    height,
    view = "both",
    isStacked = false,
    fontSettings = DEFAULT_FONT_SETTINGS,
    maxNodes = DEFAULT_MAX_NODES,
    maxNodesToShrinkOther = DEFAULT_MAX_NODES_TO_SHRINK_OTHER,
    minNodeShare = DEFAULT_MIN_NODE_SHARE,
    formatValue,
    colorMap: colorMapOverride,
}: SplitFlowSankeyProps) {
    const showIncoming = view === "both" || view === "incoming"
    const showOutgoing = view === "both" || view === "outgoing"
    const isSingleHalf = view !== "both"

    // Build both halves regardless of `view` so the color map below stays
    // stable when the user toggles imports/exports/both
    const incomingBuild = useMemo(
        () =>
            buildSankeyHalf({
                flows: incoming.rows,
                centralEntity,
                direction: "incoming",
                maxNodes,
                maxNodesToShrinkOther,
                minNodeShare,
                formatValue,
            }),
        [
            incoming.rows,
            centralEntity,
            maxNodes,
            maxNodesToShrinkOther,
            minNodeShare,
            formatValue,
        ]
    )
    const outgoingBuild = useMemo(
        () =>
            buildSankeyHalf({
                flows: outgoing.rows,
                centralEntity,
                direction: "outgoing",
                maxNodes,
                maxNodesToShrinkOther,
                minNodeShare,
                formatValue,
            }),
        [
            outgoing.rows,
            centralEntity,
            maxNodes,
            maxNodesToShrinkOther,
            minNodeShare,
            formatValue,
        ]
    )

    // Color partners by the caller-supplied map if available — this is
    // what lets a parent stabilize colors across data slices that would
    // otherwise reorder partners. Falls back to node display order
    // (value-sorted) when no override is given.
    const colorMap = useMemo(() => {
        if (colorMapOverride) return colorMapOverride
        const partners = R.pipe(
            [...(incomingBuild?.nodes ?? []), ...(outgoingBuild?.nodes ?? [])],
            R.map((n) => getPartnerFromNodeId(n.id)),
            R.filter(R.isNonNull),
            R.unique()
        )
        return assignColors(partners)
    }, [incomingBuild, outgoingBuild, colorMapOverride])

    const getNodeColor = (node: SankeyNode): string => {
        if (node.id === centralEntity) return NEUTRAL_COLOR
        const partner = getPartnerFromNodeId(node.id)
        if (partner === null) return NEUTRAL_COLOR
        return colorMap.get(partner) ?? NEUTRAL_COLOR
    }

    const getLinkColor = (link: SankeyLink): string => {
        // Incoming: partner is the source; outgoing: partner is the target
        const partner =
            getPartnerFromNodeId(link.source) ??
            getPartnerFromNodeId(link.target)
        if (partner === null) return NEUTRAL_COLOR
        return colorMap.get(partner) ?? NEUTRAL_COLOR
    }

    const halfWidth =
        isSingleHalf || isStacked
            ? width
            : Math.max(0, (width - SANKEY_HALVES_GAP) / 2)

    // Measure the actual rendered heading heights
    const [incomingHeadingRef, incomingHeadingHeight] =
        useMeasuredHeight<HTMLDivElement>()
    const [outgoingHeadingRef, outgoingHeadingHeight] =
        useMeasuredHeight<HTMLDivElement>()

    const showIncomingHeading =
        showIncoming && !(incomingBuild === undefined && incoming.empty)
    const showOutgoingHeading =
        showOutgoing && !(outgoingBuild === undefined && outgoing.empty)

    // Only the headings that are actually rendered take up space in the grid
    const headingHeights: Array<number | undefined> = []
    if (showIncomingHeading) headingHeights.push(incomingHeadingHeight)
    if (showOutgoingHeading) headingHeights.push(outgoingHeadingHeight)

    const chartHeight = computeChartHeight({
        height,
        isStacked,
        headingHeights,
    })

    // Give both halves the same value-to-pixel scale (`ky`), so a node of
    // value X on one side renders the same height as a node of value X on
    // the other side.
    //
    // Two strategies depending on layout:
    //  - Side-by-side: each half has its own grid cell taking equal vertical
    //    space (1fr 1fr). Let the more constrained half fill `chartHeight`
    //    and shrink the other's SVG to match the same `ky` — the shorter
    //    SVG sits at the top of its cell with empty space beneath.
    //  - Stacked (mobile): cells stack vertically, so empty space beneath
    //    a shrunken half is a real gap. Instead, compute a single `ky` that
    //    fills the *combined* chart space exactly, and size each half's
    //    cell to its natural height at that `ky` (via inline
    //    grid-template-rows below). Both SVGs fill their cells with no
    //    wasted space, and the value-to-pixel scale stays consistent.
    const halfHeights = useMemo(
        () =>
            computeHalfHeights({
                chartHeight,
                isStacked,
                isSingleHalf,
                incomingBuild,
                outgoingBuild,
                centralEntity,
                fontSettings,
            }),
        [
            isSingleHalf,
            isStacked,
            incomingBuild,
            outgoingBuild,
            chartHeight,
            centralEntity,
            fontSettings,
        ]
    )

    // Equalize outer label margins across the two halves so the inner flow
    // regions end up the same width even if outer-column label widths differ
    const sharedOuterMargin = useMemo(() => {
        if (isSingleHalf || !incomingBuild || !outgoingBuild) return undefined
        const maxLabelWidth = Math.max(
            maxLabelWidthForSankeyHalf(incomingBuild, fontSettings),
            maxLabelWidthForSankeyHalf(outgoingBuild, fontSettings)
        )
        return maxLabelWidth > 0 ? maxLabelWidth + BAND_LABEL_GAP : undefined
    }, [isSingleHalf, incomingBuild, outgoingBuild, fontSettings])

    // Stacked layout: size the two chart rows to the proportional half
    // heights computed above so each cell fits its SVG exactly
    const layoutVariant = isSingleHalf ? "single" : "split"
    const gridTemplateRows =
        isStacked && !isSingleHalf
            ? `auto ${halfHeights.incoming}px auto ${halfHeights.outgoing}px`
            : undefined

    return (
        <div
            className={cx("split-flow-sankey", {
                "split-flow-sankey--stacked": isStacked,
            })}
        >
            <div
                className={`split-flow-sankey__grid split-flow-sankey__grid--${layoutVariant}`}
                style={{ gridTemplateRows }}
            >
                {showIncomingHeading && (
                    <SankeyHalfHeading
                        heading={incoming.heading}
                        align="right"
                        innerRef={incomingHeadingRef}
                    />
                )}
                {showOutgoingHeading && (
                    <SankeyHalfHeading
                        heading={outgoing.heading}
                        align="left"
                        innerRef={outgoingHeadingRef}
                    />
                )}
                {showIncoming && (
                    <SankeyHalfChart
                        direction="incoming"
                        half={incoming}
                        build={incomingBuild}
                        width={halfWidth}
                        height={halfHeights.incoming}
                        centralEntity={centralEntity}
                        sharedOuterMargin={sharedOuterMargin}
                        fontSettings={fontSettings}
                        nodeColor={getNodeColor}
                        linkColor={getLinkColor}
                    />
                )}
                {showOutgoing && (
                    <SankeyHalfChart
                        direction="outgoing"
                        half={outgoing}
                        build={outgoingBuild}
                        width={halfWidth}
                        height={halfHeights.outgoing}
                        centralEntity={centralEntity}
                        sharedOuterMargin={sharedOuterMargin}
                        fontSettings={fontSettings}
                        nodeColor={getNodeColor}
                        linkColor={getLinkColor}
                    />
                )}
            </div>
        </div>
    )
}

function SankeyHalfHeading({
    heading,
    align,
    innerRef,
}: {
    heading: SankeyHalfHeading
    align: "left" | "right"
    innerRef?: React.Ref<HTMLDivElement>
}) {
    return (
        <div
            ref={innerRef}
            className={`split-flow-sankey__heading split-flow-sankey__heading--${align}`}
        >
            {heading.arrowSide === "start" && (
                <span className="split-flow-sankey__heading-arrow">→ </span>
            )}
            {heading.label}
            {heading.arrowSide === "end" && (
                <span className="split-flow-sankey__heading-arrow"> →</span>
            )}
            {heading.annotation && (
                <span className="split-flow-sankey__heading-annotation">
                    {heading.annotation}
                </span>
            )}
        </div>
    )
}

function SankeyHalfChart({
    direction,
    half,
    build,
    width,
    height,
    centralEntity,
    sharedOuterMargin,
    fontSettings,
    nodeColor,
    linkColor,
}: {
    direction: "incoming" | "outgoing"
    half: SankeyHalf
    build: SankeyHalfBuild | undefined
    width: number
    height: number
    centralEntity: string
    sharedOuterMargin?: number
    fontSettings: FontSettings
    nodeColor: (node: SankeyNode) => string
    linkColor: (link: SankeyLink) => string
}) {
    const innerMargin =
        direction === "incoming"
            ? { left: sharedOuterMargin }
            : { right: sharedOuterMargin }

    const getLinkTooltip =
        half.getTooltip && build
            ? makeLinkTooltipGetter({
                  direction,
                  centralEntity,
                  otherBreakdown: build.otherBreakdown,
                  render: half.getTooltip,
              })
            : undefined

    const getNodeTooltip =
        half.getTooltip && build
            ? makeNodeTooltipGetter({
                  otherBreakdown: build.otherBreakdown,
                  render: half.getTooltip,
              })
            : undefined

    return (
        <div
            className={`split-flow-sankey__chart-area split-flow-sankey__chart-area--${direction}`}
        >
            {build ? (
                <div className="split-flow-sankey__chart">
                    {width > 0 && height > 0 && (
                        <Sankey
                            nodes={build.nodes}
                            links={build.links}
                            width={width}
                            height={height}
                            nodeColor={nodeColor}
                            linkColor={linkColor}
                            innerMargin={innerMargin}
                            fontSettings={fontSettings}
                            nodePadding={SANKEY_NODE_PADDING}
                            anchorNodeId={centralEntity}
                            getLinkTooltip={getLinkTooltip}
                            getNodeTooltip={getNodeTooltip}
                            isNodeHoverable={(node) =>
                                node.id !== centralEntity
                            }
                        />
                    )}
                </div>
            ) : (
                half.empty
            )}
        </div>
    )
}

function maxLabelWidthForSankeyHalf(
    build: SankeyHalfBuild,
    fontSettings: FontSettings
): number {
    return Math.max(
        0,
        ...build.nodes.map((n) => measureMaxLabelWidthForNode(n, fontSettings))
    )
}

function getPartnerFromNodeId(id: string): string | null {
    if (id.startsWith("in:")) return id.slice("in:".length)
    if (id.startsWith("out:")) return id.slice("out:".length)
    return null
}

function makeLinkTooltipGetter({
    direction,
    centralEntity,
    otherBreakdown,
    render,
}: {
    direction: "incoming" | "outgoing"
    centralEntity: string
    otherBreakdown?: EntityTotal[]
    render: (args: SankeyHalfTooltipArgs) => SankeyTooltip | undefined
}): (args: LinkTooltipArgs) => SankeyTooltip | undefined {
    return ({ link }) => {
        const partnerId =
            direction === "incoming"
                ? link.source !== centralEntity
                    ? link.source
                    : link.target
                : link.target !== centralEntity
                  ? link.target
                  : link.source
        const partnerKey = getPartnerFromNodeId(partnerId) ?? partnerId
        const isOther = partnerKey === OTHER_KEY
        const partner = isOther ? "Other" : partnerKey
        return render({
            partner,
            value: link.value,
            otherBreakdown: isOther ? otherBreakdown : undefined,
        })
    }
}

function makeNodeTooltipGetter({
    otherBreakdown,
    render,
}: {
    otherBreakdown?: EntityTotal[]
    render: (args: SankeyHalfTooltipArgs) => SankeyTooltip | undefined
}): (args: NodeTooltipArgs) => SankeyTooltip | undefined {
    return ({ node, incomingLinks, outgoingLinks }) => {
        // Central is excluded by `isNodeHoverable`, so any node reaching
        // here is a partner with exactly one connecting link
        const link = incomingLinks[0] ?? outgoingLinks[0]
        if (!link) return undefined
        const partnerKey = getPartnerFromNodeId(node.id) ?? node.id
        const isOther = partnerKey === OTHER_KEY
        const partner = isOther ? "Other" : partnerKey
        return render({
            partner,
            value: link.value,
            otherBreakdown: isOther ? otherBreakdown : undefined,
        })
    }
}

/**
 * Choose which entities on a given side to show as their own Sankey node;
 * everything else is folded into an "Other" bucket.
 *
 *  1. Significance floor — show every entity individually big enough to read as
 *     its own node (≥ `minNodeShare` of the column total), largest-first, up to
 *     `maxNodes`.
 *  2. "Other"-is-smallest — a reader shouldn't see the aggregated "Other"
 *     bucket outweigh an individually named partner. While it does, promote the
 *     largest remaining entity out of "Other".
 */
export function selectTopEntities({
    flows,
    side,
    maxNodes,
    maxNodesToShrinkOther = maxNodes,
    minNodeShare,
    showAllOtherBelow = 0,
}: {
    flows: Flow[]
    side: LinkSide
    maxNodes: number
    maxNodesToShrinkOther?: number
    minNodeShare: number
    /**
     * When the Other bucket would contain this many entries or fewer,
     * fold them back into `top` instead so the chart shows each
     * individually
     */
    showAllOtherBelow?: number
}): {
    top: EntityTotal[]
    other: EntityTotal[]
    total: number
} {
    const sortedEntities = aggregateBySide(flows, side)
    const total = R.sumBy(sortedEntities, (d) => d.total)

    if (sortedEntities.length === 0 || total <= 0) {
        return { top: sortedEntities, other: [], total }
    }

    // The most nodes we'd ever draw
    const ceiling = Math.max(maxNodes, maxNodesToShrinkOther)

    // Show all if there are few enough
    if (sortedEntities.length <= ceiling) {
        return { top: sortedEntities, other: [], total }
    }

    const floor = minNodeShare * total

    // 1. Significance floor: the leading run of entities at or above the floor,
    //    but always ≥ 1 and never more than the default node budget
    const significant = R.takeWhile(
        sortedEntities,
        (d) => d.total >= floor
    ).length
    const baseCount = R.clamp(significant, { min: 1, max: maxNodes })

    // 2. "Other"-is-smallest: Promote entities out of "Other" while it both
    //    outweighs the smallest shown node and is itself above the floor,
    //    climbing up to the ceiling
    const otherTotalFrom = (k: number): number =>
        total - R.sumBy(R.take(sortedEntities, k), (d) => d.total)
    const promotions = R.takeWhile(R.range(baseCount, ceiling), (k) => {
        const otherTotal = otherTotalFrom(k)
        return otherTotal > sortedEntities[k - 1].total && otherTotal >= floor
    }).length

    const count = baseCount + promotions

    let top = R.take(sortedEntities, count)
    let other = R.drop(sortedEntities, count)

    // Inline a small Other tail
    if (other.length > 0 && other.length <= showAllOtherBelow) {
        top = [...top, ...other]
        other = []
    }

    return { top, other, total }
}

/**
 * Build a 2-column Sankey for one half: partners → central (incoming) or
 * central → partners (outgoing)
 */
function buildSankeyHalf({
    flows,
    centralEntity,
    direction,
    maxNodes,
    maxNodesToShrinkOther,
    minNodeShare,
    formatValue,
}: {
    flows: Flow[]
    centralEntity: string
    direction: "incoming" | "outgoing"
    maxNodes: number
    maxNodesToShrinkOther: number
    minNodeShare: number
    formatValue: (v: number) => string
}): SankeyHalfBuild | undefined {
    const isIncoming = direction === "incoming"
    const side = isIncoming ? "source" : "target"
    const idPrefix = isIncoming ? "in:" : "out:"

    const selection = selectTopEntities({
        flows,
        side,
        maxNodes,
        maxNodesToShrinkOther,
        minNodeShare,
        showAllOtherBelow: 1,
    })
    if (selection.top.length === 0) return undefined

    type Partner = SankeyNode & { value: number }

    const topPartners: Partner[] = selection.top.map((d) => ({
        id: idPrefix + d.entity,
        label: getEntityShortLabel(d.entity),
        valueLabel: makeValueLabel({
            value: d.total,
            total: selection.total,
            formatValue,
        }),
        value: d.total,
    }))

    const otherTotal = R.sumBy(selection.other, (d) => d.total)
    const otherPartner: Partner | null =
        otherTotal > 0
            ? { id: idPrefix + OTHER_KEY, label: "Other", value: otherTotal }
            : null

    const partners = otherPartner ? [...topPartners, otherPartner] : topPartners

    const links: SankeyLink[] = partners.map(({ id, value }) =>
        isIncoming
            ? { source: id, target: centralEntity, value }
            : { source: centralEntity, target: id, value }
    )

    // Central node sits at the open end of the half: as a sink at the end of
    // the incoming half, as a source at the start of the outgoing half
    const centralNode: SankeyNode = { id: centralEntity, label: "" }
    const nodes: SankeyNode[] = isIncoming
        ? [...partners, centralNode]
        : [centralNode, ...partners]

    return {
        nodes,
        links,
        otherBreakdown: otherPartner ? selection.other : undefined,
    }
}

/**
 * Vertical space available to the chart SVGs once the heading rows are
 * accounted for
 */
export function computeChartHeight({
    height,
    isStacked,
    headingHeights,
}: {
    height: number
    isStacked: boolean
    headingHeights: Array<number | undefined>
}): number {
    const resolvedHeadingHeights = headingHeights.map(
        (h) => h ?? HEADING_HEIGHT
    )

    if (isStacked) {
        const totalHeadingsHeight = R.sum(resolvedHeadingHeights)
        const combinedHeight =
            height - totalHeadingsHeight - STACKED_VERTICAL_PADDING
        return Math.max(0, combinedHeight / 2)
    }

    const maxHeadingHeight =
        resolvedHeadingHeights.length > 0
            ? Math.max(...resolvedHeadingHeights)
            : 0
    return Math.max(0, height - maxHeadingHeight - HEADING_CHART_GAP)
}

/**
 * Compute the per-half SVG heights so both halves end up with the same
 * value-to-pixel scale (`ky`) once d3-sankey lays them out
 */
export function computeHalfHeights({
    chartHeight,
    isStacked,
    isSingleHalf,
    incomingBuild,
    outgoingBuild,
    centralEntity,
    fontSettings,
}: {
    chartHeight: number
    isStacked: boolean
    isSingleHalf: boolean
    incomingBuild?: SankeyHalfBuild
    outgoingBuild?: SankeyHalfBuild
    centralEntity: string
    fontSettings: FontSettings
}): { incoming: number; outgoing: number } {
    if (isSingleHalf || !incomingBuild || !outgoingBuild || chartHeight <= 0) {
        return { incoming: chartHeight, outgoing: chartHeight }
    }

    const totalIn = R.sumBy(incomingBuild.links, (l) => l.value)
    const totalOut = R.sumBy(outgoingBuild.links, (l) => l.value)

    if (totalIn <= 0 || totalOut <= 0) {
        return { incoming: chartHeight, outgoing: chartHeight }
    }

    const nodeCountIn = incomingBuild.nodes.filter(
        (n) => n.id !== centralEntity
    ).length
    const nodeCountOut = outgoingBuild.nodes.filter(
        (n) => n.id !== centralEntity
    ).length

    // Sankey reserves padding on top and bottom
    const verticalLabelMargin = 2 * getSankeyVerticalLabelPadding(fontSettings)

    // Per-half non-band vertical space: inter-node gaps + top/bottom label margin
    const nonBandHeight = (nodeCount: number) =>
        Math.max(0, nodeCount - 1) * SANKEY_NODE_PADDING + verticalLabelMargin

    // Total height a half needs to render at scale `ky`:
    // sum of node bands (totalFlow × ky) + non-band height
    const heightForKy = (
        ky: number,
        totalFlow: number,
        nodeCount: number
    ): number => ky * totalFlow + nonBandHeight(nodeCount)

    // Inverse of `heightForKy`: the scale factor that makes a half exactly
    // fit `height`, given its total flow and partner-node count
    const kyForHeight = (
        height: number,
        totalFlow: number,
        nodeCount: number
    ): number => (height - nonBandHeight(nodeCount)) / totalFlow

    // Resolve each half's height at the shared `ky`
    const heightsAtKy = (ky: number): { incoming: number; outgoing: number } =>
        ky <= 0
            ? { incoming: chartHeight, outgoing: chartHeight }
            : {
                  incoming: heightForKy(ky, totalIn, nodeCountIn),
                  outgoing: heightForKy(ky, totalOut, nodeCountOut),
              }

    if (isStacked) {
        // In stacked mode the two cells sit in their own rows, so the combined
        // chart space they must exactly fill is `2 * chartHeight`. Solve for
        // the single `ky` that fits the combined space.
        const totalHeight = 2 * chartHeight
        const totalNonBandHeight =
            nonBandHeight(nodeCountIn) + nonBandHeight(nodeCountOut)

        // Solve `totalHeight = ky × (totalIn + totalOut) + totalNonBandHeight` for ky
        const ky = (totalHeight - totalNonBandHeight) / (totalIn + totalOut)

        return heightsAtKy(ky)
    }

    // Each half's "max ky" — the scale at which it would exactly fill
    // `chartHeight` if it had the full cell to itself. The shared `ky` is
    // capped by the more-constrained half (smaller of the two) so neither
    // half overflows; that half ends up filling `chartHeight`, the other
    // half's SVG comes out shorter.
    const kyInFull = kyForHeight(chartHeight, totalIn, nodeCountIn)
    const kyOutFull = kyForHeight(chartHeight, totalOut, nodeCountOut)
    const ky = Math.min(kyInFull, kyOutFull)

    return heightsAtKy(ky)
}

/**
 * Track an element's rendered height via ResizeObserver
 */
function useMeasuredHeight<E extends HTMLElement>(): [
    (node: E | null) => void,
    number | undefined,
] {
    const [height, setHeight] = useState<number | undefined>(undefined)
    const observerRef = useRef<ResizeObserver | null>(null)

    // A *callback* ref (not useRef + effect) is essential here: the headings
    // are conditionally rendered, so toggling the view swaps in fresh DOM
    // nodes. The callback re-binds the observer to each new node as it mounts,
    // and clears the measurement when the node detaches so a stale height from
    // a different layout can't leak across view switches.
    const ref = useCallback((node: E | null) => {
        // Detach any observer bound to the previous node
        observerRef.current?.disconnect()
        observerRef.current = null

        if (!node || typeof ResizeObserver === "undefined") {
            setHeight(undefined)
            return
        }

        const measure = (): void => {
            const measured = node.offsetHeight
            setHeight((prev) => (prev === measured ? prev : measured))
        }
        measure()

        const observer = new ResizeObserver(measure)
        observer.observe(node)
        observerRef.current = observer
    }, [])

    return [ref, height]
}
