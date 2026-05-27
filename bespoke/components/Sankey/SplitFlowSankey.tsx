import { useMemo } from "react"
import cx from "classnames"
import * as R from "remeda"

import { type FontSettings } from "@ourworldindata/grapher"

import {
    BAND_LABEL_GAP,
    getSankeyVerticalLabelPadding,
    LinkTooltipArgs,
    measureMaxLabelWidthForNode,
    NodeTooltipArgs,
    Sankey,
    SankeyLink,
    SankeyNode,
    SankeyTooltip,
} from "./Sankey.js"
import {
    assignColors,
    DEFAULT_MIN_NODE_SHARE,
    DEFAULT_TOP_N,
    entityShortLabel,
    EntityTotal,
    FlowRow,
    makeValueLabel,
    NEUTRAL_COLOR,
    OTHER_KEY,
    selectTopEntities,
} from "./helpers.js"

// Vertical space reserved for the heading row + row-gap in
// SplitFlowSankey.scss. Sized for the worst case where one heading wraps
// to two lines (font-size 14px × line-height 1.3 × 2 = 36.4px, plus the
// 4px grid row-gap, rounded up to 44 to give the SVG a small bottom
// breathing margin and avoid overflow when wrapping happens).
const HEADING_HEIGHT = 44
// Must match the SCSS `gap` between the two halves.
const SANKEY_HALVES_GAP = 16
// Below this container width the two halves stack vertically. Must stay
// in sync with the `@container` query in SplitFlowSankey.scss.
export const STACKED_BREAKPOINT_PX = 500

// Font for node labels at normal (side-by-side) layout. Passed explicitly
// to `<Sankey>` so the same value drives both the chart's text rendering
// and the layout math in `computeHalfHeights` below — the two must agree
// for the ky-matching invariant to hold.
export const NON_STACKED_FONT_SETTINGS: FontSettings = {
    fontSize: 12,
    fontWeight: 400,
    lineHeight: 1,
}

// Shrunk font for node labels when the two halves are stacked on narrow
// containers. Keep the SCSS heading font-size override in sync.
const STACKED_FONT_SETTINGS: FontSettings = {
    fontSize: 10.5,
    fontWeight: 400,
    lineHeight: 1,
}

// Vertical gap between nodes within a Sankey column. Owned here (rather
// than relying on Sankey's internal default) so the same value drives
// both the explicit `nodePadding` prop passed to `<Sankey>` and the
// `computeHalfHeights` math that has to mirror d3-sankey's layout.
export const SANKEY_NODE_PADDING = 12

// Vertical space the stacked layout consumes outside the two chart cells,
// beyond the two heading rows we already reserve via HEADING_HEIGHT. Just
// the second heading's margin-top in stacked mode (row-gap is overridden
// to 0 in the @container query — keep both in sync).
const STACKED_VERTICAL_OVERHEAD = 16

type View = "both" | "incoming" | "outgoing"

export type HeadingContent = {
    /** Main heading text, rendered in the heading's primary weight. */
    label: string
    /** Optional secondary text (e.g. a percentage of a denominator)
     *  rendered in a lighter weight after the label. */
    annotation?: string
    /** When set, renders a directional arrow on the given side of the
     *  heading, bookending the annotation if one is present. */
    arrowSide?: "start" | "end"
}

type Half = {
    rows: FlowRow[]
    /** Heading shown above this half. Callers pass a different label when
     * `rows` is empty (e.g. "No imports"). */
    heading: HeadingContent
    /** Optional placeholder rendered inside the half's chart-area when
     *  `rows` produces no Sankey build. When provided, the half's heading
     *  is also suppressed so the placeholder occupies the full half. */
    empty?: React.ReactNode
    /** Per-half tooltip renderer. The hovered link's `partner` is the
     *  non-central endpoint (already de-prefixed); link.value is the raw
     *  flow value. SplitFlowSankey hides the `in:`/`out:` ID scheme from
     *  this callback. */
    renderTooltip?: (args: HalfTooltipArgs) => SankeyTooltip | undefined
}

export type HalfTooltipArgs = {
    /** Display name of the non-central endpoint (e.g. "China" or "Other"). */
    partner: string
    value: number
    /** Per-entity breakdown of the "Other" bucket, sorted desc by value.
     *  Set only when the hovered link points at the Other bucket; otherwise
     *  undefined. Lets callers render a richer tooltip for Other (e.g. a
     *  table of the bundled countries) without re-deriving the grouping. */
    otherBreakdown?: EntityTotal[]
}

export type SankeyBuild = {
    nodes: SankeyNode[]
    links: SankeyLink[]
    /** Entities folded into this half's Other bucket. Empty / undefined when
     *  no Other bucket was produced. Sorted desc by value. */
    otherBreakdown?: EntityTotal[]
}

/**
 * Compute the per-half SVG heights so both halves end up with the same
 * value-to-pixel scale (`ky`) once d3-sankey lays them out. Pure, exported
 * for testing: feeding each returned height back into d3-sankey (with the
 * same options Sankey.tsx uses) should yield matching `ky` on both halves.
 *
 * See the comment block in `SplitFlowSankey` that explains the side-by-side
 * vs stacked strategies — this function mirrors that logic.
 */
export function computeHalfHeights({
    chartHeight,
    isStacked,
    isSingleHalf,
    incomingBuild,
    outgoingBuild,
    central,
    fontSettings,
}: {
    chartHeight: number
    isStacked: boolean
    isSingleHalf: boolean
    incomingBuild: SankeyBuild | null
    outgoingBuild: SankeyBuild | null
    central: string
    fontSettings: FontSettings
}): { incoming: number; outgoing: number } {
    if (isSingleHalf || !incomingBuild || !outgoingBuild || chartHeight <= 0) {
        return { incoming: chartHeight, outgoing: chartHeight }
    }
    const tIn = halfTotal(incomingBuild)
    const tOut = halfTotal(outgoingBuild)
    const nIn = partnerNodeCount(incomingBuild, central)
    const nOut = partnerNodeCount(outgoingBuild, central)
    if (tIn <= 0 || tOut <= 0) {
        return { incoming: chartHeight, outgoing: chartHeight }
    }

    // Sankey reserves the per-side padding on BOTH top and bottom, so
    // the per-cell overhead is 2× that. Counting both sides is what
    // keeps the two halves' actual `ky` matching after d3-sankey lays
    // out — counting one side makes the shorter half come out squished
    // by `(verticalLabelPadding / t)`.
    const verticalLabelMargin = 2 * getSankeyVerticalLabelPadding(fontSettings)

    const heightForKy = (ky: number, t: number, n: number) =>
        ky * t + Math.max(0, n - 1) * SANKEY_NODE_PADDING + verticalLabelMargin
    const kyForHeight = (h: number, t: number, n: number) =>
        (h - verticalLabelMargin - Math.max(0, n - 1) * SANKEY_NODE_PADDING) / t

    if (isStacked) {
        // Stacked: solve for the `ky` that exactly fills both cells
        // combined. `chartHeight` in stacked mode is per-cell, so the
        // combined chart space is `2 * chartHeight`. Each cell carries
        // its own verticalLabelMargin (top+bottom), hence the `2 *`.
        //   heightForKy(ky, tIn, nIn) + heightForKy(ky, tOut, nOut)
        //     = 2 * chartHeight
        //   ky * (tIn + tOut) + (nIn + nOut - 2) * PAD + 2 * MARGIN
        //     = 2 * chartHeight
        const totalChartSpace = 2 * chartHeight
        const overhead =
            2 * verticalLabelMargin +
            Math.max(0, nIn + nOut - 2) * SANKEY_NODE_PADDING
        const ky = (totalChartSpace - overhead) / (tIn + tOut)
        if (ky <= 0) return { incoming: chartHeight, outgoing: chartHeight }
        return {
            incoming: heightForKy(ky, tIn, nIn),
            outgoing: heightForKy(ky, tOut, nOut),
        }
    }

    const kyInFull = kyForHeight(chartHeight, tIn, nIn)
    const kyOutFull = kyForHeight(chartHeight, tOut, nOut)
    const ky = Math.min(kyInFull, kyOutFull)
    if (ky <= 0) return { incoming: chartHeight, outgoing: chartHeight }

    return {
        incoming: Math.min(chartHeight, heightForKy(ky, tIn, nIn)),
        outgoing: Math.min(chartHeight, heightForKy(ky, tOut, nOut)),
    }
}

export function SplitFlowSankey({
    incoming,
    outgoing,
    central,
    width,
    height,
    formatValue,
    view = "both",
    topN = DEFAULT_TOP_N,
    minNodeShare = DEFAULT_MIN_NODE_SHARE,
}: {
    /** The entity anchoring both halves. */
    central: string
    /** Flows arriving at the central entity (target must equal `central`). */
    incoming: Half
    /** Flows leaving the central entity (source must equal `central`). */
    outgoing: Half
    width: number
    height: number
    formatValue: (v: number) => string
    /** Which halves to show. Single-half view takes the full width. */
    view?: View
    topN?: number
    /** Minimum share of its column total an entity must reach to keep its own
     * node slot; below this it's folded into the "Other" bucket. */
    minNodeShare?: number
}) {
    const showIncoming = view === "both" || view === "incoming"
    const showOutgoing = view === "both" || view === "outgoing"
    const isSingleHalf = view !== "both"

    // Build both halves regardless of `view` so the color map below stays
    // stable when the user toggles imports/exports/both. View only controls
    // which `<Half>` is rendered, not what's used for color assignment.
    const incomingBuild = useMemo(
        () =>
            buildHalf({
                rows: incoming.rows,
                central,
                direction: "incoming",
                topN,
                minNodeShare,
                formatValue,
            }),
        [incoming.rows, central, topN, minNodeShare, formatValue]
    )
    const outgoingBuild = useMemo(
        () =>
            buildHalf({
                rows: outgoing.rows,
                central,
                direction: "outgoing",
                topN,
                minNodeShare,
                formatValue,
            }),
        [outgoing.rows, central, topN, minNodeShare, formatValue]
    )

    // Color partners in node display order. Half-builds emit nodes sorted
    // by per-half total, so iterating both halves and deduping by first
    // occurrence gives a stable shared palette: a partner appearing in both
    // halves gets one color, and earlier-ranked partners in either half take
    // the most distinctive palette slots.
    const colorMap = useMemo(() => {
        const partners = R.pipe(
            [...(incomingBuild?.nodes ?? []), ...(outgoingBuild?.nodes ?? [])],
            R.map((n) => partnerFromId(n.id)),
            R.filter(R.isNonNull),
            R.unique()
        )
        return assignColors(partners)
    }, [incomingBuild, outgoingBuild])

    const nodeColor = (node: SankeyNode): string => {
        if (node.id === central) return NEUTRAL_COLOR
        const partner = partnerFromId(node.id)
        if (partner === null) return NEUTRAL_COLOR
        return colorMap.get(partner) ?? NEUTRAL_COLOR
    }

    const linkColor = (link: SankeyLink): string => {
        // Incoming: partner is the source; outgoing: partner is the target.
        const partner = partnerFromId(link.source) ?? partnerFromId(link.target)
        if (partner === null) return NEUTRAL_COLOR
        return colorMap.get(partner) ?? NEUTRAL_COLOR
    }

    // Narrow containers stack the two halves vertically. CSS handles the
    // layout switch via an `@container` query; the JS just needs to size
    // each half's SVG to fill the (now vertical) cell.
    const isStacked =
        !isSingleHalf && width > 0 && width < STACKED_BREAKPOINT_PX
    const fontSettings: FontSettings = isStacked
        ? STACKED_FONT_SETTINGS
        : NON_STACKED_FONT_SETTINGS

    // Equalize outer label margins across the two halves so the inner flow
    // regions end up the same width even if outer-column label widths differ.
    // Only applies in the both-halves view; single-half views use the natural
    // auto-computed margin.
    const sharedOuterMargin = useMemo(() => {
        if (isSingleHalf || !incomingBuild || !outgoingBuild) return undefined
        const max = Math.max(
            maxLabelWidthForBuild(incomingBuild, fontSettings),
            maxLabelWidthForBuild(outgoingBuild, fontSettings)
        )
        return max > 0 ? max + BAND_LABEL_GAP : undefined
    }, [isSingleHalf, incomingBuild, outgoingBuild, fontSettings])
    const halfWidth =
        isSingleHalf || isStacked
            ? width
            : Math.max(0, (width - SANKEY_HALVES_GAP) / 2)
    const chartHeight = isStacked
        ? Math.max(
              0,
              (height - 2 * HEADING_HEIGHT - STACKED_VERTICAL_OVERHEAD) / 2
          )
        : Math.max(0, height - HEADING_HEIGHT)

    // Give both halves the same value-to-pixel scale (`ky`), so a node of
    // value X on one side renders the same height as a node of value X on
    // the other side. d3-sankey otherwise sizes each half independently to
    // fill its vertical extent, which makes the central node look the same
    // height in both halves regardless of how the totals compare.
    //
    // Two strategies depending on layout:
    //  - Side-by-side: each half has its own grid cell taking equal vertical
    //    space (1fr 1fr). Let the more constrained half fill `chartHeight`
    //    and shrink the other's SVG to match the same `ky` — the shorter
    //    SVG sits at the top of its cell with empty space beneath, which is
    //    invisible since the other half is right next to it.
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
                central,
                fontSettings,
            }),
        [
            isSingleHalf,
            isStacked,
            incomingBuild,
            outgoingBuild,
            chartHeight,
            central,
            fontSettings,
        ]
    )

    // Layout: an outer wrapper carries the container declaration so the
    // `@container` query in the SCSS can target the inner grid (CSS
    // container queries apply to descendants only, not the container
    // element itself). The inner grid renders all headings in row 1, then
    // all chart-areas in row 2 (auto-placement, row-major), so the two
    // chart bodies stay top-aligned even when one heading wraps to a
    // second line. On narrow containers the @container query switches the
    // inner grid to a single column with explicit grid-row per child.
    // When a half is empty and the consumer has supplied a centered
    // placeholder, drop the heading for that half — the placeholder is
    // the message.
    const showIncomingHeading =
        showIncoming && !(incomingBuild === null && incoming.empty)
    const showOutgoingHeading =
        showOutgoing && !(outgoingBuild === null && outgoing.empty)

    const layoutVariant = isSingleHalf ? "single" : "split"
    // Stacked layout: size the two chart rows to the proportional half
    // heights computed above so each cell fits its SVG exactly — no
    // whitespace below the shrunken half. The headings stay `auto`.
    // The default CSS (auto 1fr auto 1fr from the @container query) is
    // overridden when this inline style is set.
    const gridStyle: React.CSSProperties | undefined =
        isStacked && !isSingleHalf
            ? {
                  gridTemplateRows: `auto ${halfHeights.incoming}px auto ${halfHeights.outgoing}px`,
              }
            : undefined
    return (
        <div
            className={cx("split-flow-sankey", {
                "split-flow-sankey--stacked": isStacked,
            })}
        >
            <div
                className={`split-flow-sankey__grid split-flow-sankey__grid--${layoutVariant}`}
                style={gridStyle}
            >
                {showIncomingHeading && (
                    <HalfHeading heading={incoming.heading} align="right" />
                )}
                {showOutgoingHeading && (
                    <HalfHeading heading={outgoing.heading} align="left" />
                )}
                {showIncoming && (
                    <HalfChart
                        which="incoming"
                        build={incomingBuild}
                        empty={incoming.empty}
                        width={halfWidth}
                        height={halfHeights.incoming}
                        nodeColor={nodeColor}
                        linkColor={linkColor}
                        innerMargin={{ left: sharedOuterMargin }}
                        fontSettings={fontSettings}
                        anchorNodeId={central}
                        getLinkTooltip={
                            incoming.renderTooltip && incomingBuild
                                ? wrapHalfTooltipRenderer({
                                      direction: "incoming",
                                      central,
                                      otherBreakdown:
                                          incomingBuild.otherBreakdown,
                                      render: incoming.renderTooltip,
                                  })
                                : undefined
                        }
                        getNodeTooltip={
                            incoming.renderTooltip && incomingBuild
                                ? wrapHalfNodeTooltipRenderer({
                                      otherBreakdown:
                                          incomingBuild.otherBreakdown,
                                      render: incoming.renderTooltip,
                                  })
                                : undefined
                        }
                        isNodeHoverable={(node) => node.id !== central}
                    />
                )}
                {showOutgoing && (
                    <HalfChart
                        which="outgoing"
                        build={outgoingBuild}
                        empty={outgoing.empty}
                        width={halfWidth}
                        height={halfHeights.outgoing}
                        nodeColor={nodeColor}
                        linkColor={linkColor}
                        innerMargin={{ right: sharedOuterMargin }}
                        fontSettings={fontSettings}
                        anchorNodeId={central}
                        getLinkTooltip={
                            outgoing.renderTooltip && outgoingBuild
                                ? wrapHalfTooltipRenderer({
                                      direction: "outgoing",
                                      central,
                                      otherBreakdown:
                                          outgoingBuild.otherBreakdown,
                                      render: outgoing.renderTooltip,
                                  })
                                : undefined
                        }
                        getNodeTooltip={
                            outgoing.renderTooltip && outgoingBuild
                                ? wrapHalfNodeTooltipRenderer({
                                      otherBreakdown:
                                          outgoingBuild.otherBreakdown,
                                      render: outgoing.renderTooltip,
                                  })
                                : undefined
                        }
                        isNodeHoverable={(node) => node.id !== central}
                    />
                )}
            </div>
        </div>
    )
}

// Largest label-pixel-width across all nodes in a half-Sankey build. The
// inner-column central node carries an empty label and contributes 0, so it
// doesn't pollute the max.
function maxLabelWidthForBuild(
    build: SankeyBuild,
    fontSettings: FontSettings
): number {
    return Math.max(
        0,
        ...build.nodes.map((n) => measureMaxLabelWidthForNode(n, fontSettings))
    )
}

// Total flow through the half — equals the central node's value on each side.
function halfTotal(build: SankeyBuild): number {
    return build.links.reduce((sum, l) => sum + l.value, 0)
}

// Number of partner nodes (everything except the central node) — used to
// account for `nodePadding` when computing the value-to-pixel scale.
function partnerNodeCount(build: SankeyBuild, central: string): number {
    return build.nodes.filter((n) => n.id !== central).length
}

// Extract the partner key from a centered-Sankey node ID. Naturally returns
// OTHER_KEY for either Other bucket (their IDs are in:/out: + OTHER_KEY) so
// they share one color across both halves. Returns null for the central
// entity (handled separately).
function partnerFromId(id: string): string | null {
    if (id.startsWith("in:")) return id.slice("in:".length)
    if (id.startsWith("out:")) return id.slice("out:".length)
    return null
}

// Adapt a half-level tooltip renderer (which thinks in {partner, value}) to
// the Sankey-level getLinkTooltip signature. For the incoming half the
// partner is the link source; for the outgoing half it's the target. The
// Other bucket's raw key (OTHER_KEY) is mapped back to its display label
// "Other" so callers don't have to know about the internal sentinel; when
// the link points at Other we also forward the half's bundled-entity
// breakdown so the caller can render a richer tooltip for it.
function wrapHalfTooltipRenderer({
    direction,
    central,
    otherBreakdown,
    render,
}: {
    direction: "incoming" | "outgoing"
    central: string
    otherBreakdown?: EntityTotal[]
    render: (args: HalfTooltipArgs) => SankeyTooltip | undefined
}): (args: LinkTooltipArgs) => SankeyTooltip | undefined {
    return ({ link }) => {
        const partnerId =
            direction === "incoming"
                ? link.source !== central
                    ? link.source
                    : link.target
                : link.target !== central
                  ? link.target
                  : link.source
        const partnerKey = partnerFromId(partnerId) ?? partnerId
        const isOther = partnerKey === OTHER_KEY
        const partner = isOther ? "Other" : partnerKey
        return render({
            partner,
            value: link.value,
            otherBreakdown: isOther ? otherBreakdown : undefined,
        })
    }
}

// Node-hover sibling of `wrapHalfTooltipRenderer`. Each half is a 2-column
// Sankey, so a hovered partner node has exactly one connected link: that
// link's value is the partner's total. The shape of HalfTooltipArgs is
// identical to the link-hover path, so the consumer's render callback
// doesn't need to distinguish where the hover came from.
function wrapHalfNodeTooltipRenderer({
    otherBreakdown,
    render,
}: {
    otherBreakdown?: EntityTotal[]
    render: (args: HalfTooltipArgs) => SankeyTooltip | undefined
}): (args: NodeTooltipArgs) => SankeyTooltip | undefined {
    return ({ node, incomingLinks, outgoingLinks }) => {
        // Central is excluded by `isNodeHoverable`, so any node reaching
        // here is a partner with exactly one connecting link.
        const link = incomingLinks[0] ?? outgoingLinks[0]
        if (!link) return undefined
        const partnerKey = partnerFromId(node.id) ?? node.id
        const isOther = partnerKey === OTHER_KEY
        const partner = isOther ? "Other" : partnerKey
        return render({
            partner,
            value: link.value,
            otherBreakdown: isOther ? otherBreakdown : undefined,
        })
    }
}

function HalfHeading({
    heading,
    align,
}: {
    heading: HeadingContent
    align: "left" | "right"
}) {
    return (
        <div
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

function HalfChart({
    which,
    build,
    empty,
    width,
    height,
    nodeColor,
    linkColor,
    innerMargin,
    fontSettings,
    anchorNodeId,
    getLinkTooltip,
    getNodeTooltip,
    isNodeHoverable,
}: {
    which: "incoming" | "outgoing"
    build: SankeyBuild | null
    /** Rendered in place of the Sankey when this half has no flows. */
    empty?: React.ReactNode
    width: number
    height: number
    nodeColor: (node: SankeyNode) => string
    linkColor: (link: SankeyLink) => string
    innerMargin?: {
        top?: number
        right?: number
        bottom?: number
        left?: number
    }
    fontSettings: FontSettings
    anchorNodeId?: string
    getLinkTooltip?: (args: LinkTooltipArgs) => SankeyTooltip | undefined
    getNodeTooltip?: (args: NodeTooltipArgs) => SankeyTooltip | undefined
    isNodeHoverable?: (node: SankeyNode) => boolean
}) {
    return (
        <div
            className={`split-flow-sankey__chart-area split-flow-sankey__chart-area--${which}`}
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
                            anchorNodeId={anchorNodeId}
                            getLinkTooltip={getLinkTooltip}
                            getNodeTooltip={getNodeTooltip}
                            isNodeHoverable={isNodeHoverable}
                        />
                    )}
                </div>
            ) : (
                empty
            )}
        </div>
    )
}

// Build a 2-column Sankey for one half: partners → central (incoming) or
// central → partners (outgoing). Returns null when there's no flow (caller
// renders an empty placeholder).
//
// IDs are prefixed (in:/out:) so a partner appearing on both halves ends up
// as two distinct nodes across the split.
function buildHalf({
    rows,
    central,
    direction,
    topN,
    minNodeShare,
    formatValue,
}: {
    rows: FlowRow[]
    central: string
    direction: "incoming" | "outgoing"
    topN: number
    minNodeShare: number
    formatValue: (v: number) => string
}): SankeyBuild | null {
    const isIncoming = direction === "incoming"
    const side = isIncoming ? "source" : "target"
    const idPrefix = isIncoming ? "in:" : "out:"

    const selection = selectTopEntities({
        rows,
        side,
        topN,
        minNodeShare,
        // A 1- or 2-country "Other" bucket doesn't visually compress
        // anything — show them as their own ribbons instead so the
        // central country's flows read more directly.
        showAllOtherBelow: 1,
    })
    if (selection.top.length === 0) return null

    // Partner nodes carry a `value` field alongside the SankeyNode fields —
    // used below to build each partner's link. SankeyNode ignores the extra.
    type Partner = SankeyNode & { value: number }

    const topPartners: Partner[] = selection.top.map((d) => ({
        // ID stays as the full entity name — used for color matching and
        // tooltip lookups, where consistency across both halves and the
        // chart's full-name surface matters. The on-chart label uses the
        // shorter form for readability.
        id: idPrefix + d.entity,
        label: entityShortLabel(d.entity),
        valueLabel: makeValueLabel({
            value: d.total,
            total: selection.grandTotal,
            formatValue,
        }),
        value: d.total,
    }))

    const otherPartner: Partner | null =
        selection.otherTotal > 0
            ? {
                  id: idPrefix + OTHER_KEY,
                  label: "Other",
                  value: selection.otherTotal,
              }
            : null

    const partners = otherPartner ? [...topPartners, otherPartner] : topPartners

    const links: SankeyLink[] = partners.map(({ id, value }) =>
        isIncoming
            ? { source: id, target: central, value }
            : { source: central, target: id, value }
    )

    // Central node sits at the open end of the half: as a sink at the end of
    // the incoming half, as a source at the start of the outgoing half. Empty
    // label — the chart title names it, and the inner edge meets the other
    // half's central rect. Sankey tags it with `sankey__node--anchored` /
    // `sankey__label--anchored` (via `anchorNodeId`), which the SplitFlow
    // stylesheet uses to keep both halves' central rects at full opacity
    // during any hover — otherwise the un-hovered half's central would dim
    // and split the visually-continuous central column.
    const centralNode: SankeyNode = {
        id: central,
        label: "",
    }
    const nodes: SankeyNode[] = isIncoming
        ? [...partners, centralNode]
        : [centralNode, ...partners]

    return {
        nodes,
        links,
        otherBreakdown: otherPartner ? selection.other : undefined,
    }
}
