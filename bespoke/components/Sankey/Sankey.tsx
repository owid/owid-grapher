import React, { useCallback, useMemo, useRef, useState } from "react"
import {
    sankey as d3Sankey,
    SankeyGraph,
    SankeyNode as D3SankeyNode,
    SankeyLink as D3SankeyLink,
} from "d3-sankey"
import {
    Bounds,
    getRelativeMouse,
    PointVector,
    VerticalAlign,
} from "@ourworldindata/utils"
import { GrapherTooltipAnchor } from "@ourworldindata/types"
import {
    GRAPHER_DARK_TEXT,
    GRAPHER_DENIM,
    GRAPHER_LIGHT_TEXT,
    type FontSettings,
} from "@ourworldindata/grapher"
import { TooltipCard } from "@ourworldindata/grapher/src/tooltip/TooltipCard.js"
import { TextWrap, TextWrapSvg } from "@ourworldindata/components"
import cx from "clsx"
import { usePinnedTooltip } from "../../hooks/usePinnedTooltip.js"
import { match } from "ts-pattern"

/* Horizontal gap between a node's edge and its label */
export const BAND_LABEL_GAP = 6

/** Width and height of a node's optional icon, drawn next to its label */
export const SANKEY_ICON_SIZE = 16

/** Horizontal gap between a node's icon and its label text */
export const SANKEY_ICON_TEXT_GAP = 8

/** How far the white disc behind an icon extends past the icon's box */
const ICON_BACKING_PADDING = 2

/** Vertical gap between a node's value label and its label */
const VALUE_LABEL_GAP = 2

/** How far a ribbon reaches under a middle node's band, in px */
const RIBBON_NODE_OVERLAP = 0.5

/** Smallest height a node's band is drawn at, however small its value */
const MIN_NODE_DRAWN_HEIGHT = 1

/** Vertical gap between the column headings and the top of the chart */
const COLUMN_HEADING_GAP = 8

/**
 * Where a column heading's baseline sits below the top of its row, in ems.
 * Placed explicitly rather than with `dominant-baseline="hanging"`, whose
 * position browsers synthesize differently: Android Chrome puts it low
 * enough for the glyphs to poke out of the top of the SVG and be clipped.
 */
const COLUMN_HEADING_BASELINE_EM = 0.9

/** Smallest horizontal gap between two neighbouring column headings */
const COLUMN_HEADING_MIN_SPACING = 16

const COLUMN_HEADING_FONT_WEIGHT = 400
const COLUMN_HEADING_EMPHASIS_FONT_WEIGHT = 700

/** Extra vertical pixels past a link's band edge that still count as a hit */
const LINK_BAND_GAP_TOLERANCE = 6

/** Extra pixels past a node's hit shape that still count as a hit */
const NODE_HIT_TOLERANCE = 8

const DEFAULT_MARGIN: Margin = { top: 0, right: 0, bottom: 0, left: 0 }

// Must be defined here to keep a stable reference across renders
const DEFAULT_FONT_SETTINGS: FontSettings = {
    fontSize: 12,
    fontWeight: 400,
    lineHeight: 1,
}

interface SankeyProps {
    nodes: SankeyNode[]
    links: SankeyLink[]
    width: number
    height: number
    totalFlowVolume?: number
    linkLowVolumeThreshold?: number
    nodeColor?: (node: SankeyNode) => string
    linkColor?: (link: SankeyLink) => string
    /**
     * Whether a link below `linkLowVolumeThreshold` is drawn faded; default
     * all of them. Exempt links whose neighbours would otherwise show a pale
     * stripe through one continuous block of colour.
     */
    canFadeLowVolumeLink?: (link: SankeyLink) => boolean
    /** Outer padding around the whole visualization */
    margin?: Margin
    /** Floor for the inner padding that reserves space for labels */
    innerMargin?: Partial<Margin>
    /**
     * When set, skip d3-sankey's vertical relaxation and pin the named
     * node to the top of its column
     */
    anchorNodeId?: string
    /** Vertical padding between nodes within a column */
    nodePadding?: number
    /** Width of each node's visible band on its outer edge */
    bandWidth?: number
    /** Whitespace between a node's band and the flow path */
    bandFlowGap?: number
    fontSettings?: FontSettings
    /**
     * One heading per column, left to right, drawn above the chart and
     * aligned with that column's labels (so they stay put however the label
     * margins come out). Reserves its own space at the top. A heading is a
     * plain string or a run of parts, some emphasised — e.g. the three
     * headings can together read as one sentence whose key words stand out.
     */
    columnHeadings?: SankeyColumnHeading[]
    /**
     * Shorter sets of headings to fall back on, in order, when the preferred
     * `columnHeadings` don't fit side by side at the current width. If none
     * fits, the last set is drawn with overlapping headings pushed apart.
     */
    columnHeadingFallbacks?: SankeyColumnHeading[][]
    /**
     * Which side of a middle column's band its labels sit on (they lie over
     * the ribbons either way). Default right; pick the side whose ribbons are
     * calmer.
     */
    middleLabelSide?: "left" | "right"
    getNodeTooltip?: (args: NodeTooltipArgs) => SankeyTooltip | undefined
    getLinkTooltip?: (args: LinkTooltipArgs) => SankeyTooltip | undefined
    onNodeClick?: (node: SankeyNode) => void
    isNodeClickable?: (node: SankeyNode) => boolean
    isNodeHoverable?: (node: SankeyNode) => boolean
    onLinkClick?: (link: SankeyLink) => void
    isLinkClickable?: (link: SankeyLink) => boolean
    /** Other links to be highlighted as a group with the hovered one */
    getRelatedLinks?: (link: SankeyLink) => SankeyLink[]
    /**
     * Links beyond the hovered node's own that should light up with it, e.g.
     * where its flows continue in the next column. Without it a node hover
     * highlights just the links touching the node.
     */
    getRelatedLinksForNode?: (args: NodeTooltipArgs) => SankeyLink[]
}

export type NodeTooltipArgs = {
    node: SankeyNode
    incomingLinks: SankeyLink[]
    outgoingLinks: SankeyLink[]
}

export type LinkTooltipArgs = {
    link: SankeyLink
}

export type SankeyTooltip = {
    title: string
    subtitle?: string
    content: React.ReactNode
}

export type SankeyNode = {
    id: string
    label: string
    valueLabel?: string
    /**
     * Optional icon drawn next to the node's label, between the node's band
     * and the label text. Any SVG content designed for a `0 0 16 16` viewBox.
     */
    icon?: React.ReactNode
}

export type SankeyLink = {
    source: string
    target: string
    value: number
    /**
     * Tells apart parallel links between the same two nodes (e.g. one link
     * per upstream partner into a shared sink), so each can be drawn,
     * coloured and highlighted on its own. Part of the link's identity; omit
     * it when every source → target pair is unique.
     */
    category?: string
}

/** Which side of a link (or, equivalently, which column of the chart). */
export type LinkSide = "source" | "target"

/**
 * Which column a node sits in: the outer left one, the outer right one, or
 * any column in between (only possible in graphs with three or more columns).
 */
export type SankeyNodeSide = "left" | "right" | "middle"

type PlacedSankeyLabel = {
    nodeId: string
    x: number
    y: number
    textAnchor: "start" | "end"
    side: SankeyNodeSide
    label: TextWrap
    valueLabel?: TextWrap
    icon?: React.ReactNode
    /** False on a node too short for its icon: the text keeps the icon's
     *  space so labels in a column stay aligned, but the icon isn't drawn */
    isIconVisible: boolean
}

export type SankeyColumnHeadingPart = { text: string; emphasis?: boolean }
export type SankeyColumnHeading = string | SankeyColumnHeadingPart[]

type PlacedColumnHeading = {
    columnIndex: number
    parts: SankeyColumnHeadingPart[]
    x: number
    y: number
    textAnchor: "start" | "middle" | "end"
}

type Margin = { top: number; right: number; bottom: number; left: number }

type SankeyLayoutNode = SankeyNode
type LaidOutGraph = SankeyGraph<SankeyLayoutNode, SankeyLink>
type LaidOutNode = D3SankeyNode<SankeyLayoutNode, SankeyLink>
type LaidOutLink = D3SankeyLink<SankeyLayoutNode, SankeyLink>

type HoverState =
    | { kind: "link"; link: LaidOutLink; position: { x: number; y: number } }
    | { kind: "node"; node: LaidOutNode; position: { x: number; y: number } }

export function Sankey({
    nodes,
    links,
    width,
    height,
    totalFlowVolume,
    linkLowVolumeThreshold,
    nodeColor,
    linkColor,
    canFadeLowVolumeLink,
    margin = DEFAULT_MARGIN,
    innerMargin,
    anchorNodeId,
    nodePadding = 12,
    bandWidth = 4,
    bandFlowGap = 3,
    fontSettings = DEFAULT_FONT_SETTINGS,
    columnHeadings,
    columnHeadingFallbacks,
    middleLabelSide = "right",
    getLinkTooltip,
    getRelatedLinks,
    getRelatedLinksForNode,
    getNodeTooltip,
    isNodeHoverable,
    onNodeClick,
    isNodeClickable,
    onLinkClick,
    isLinkClickable,
}: SankeyProps): React.ReactElement | null {
    const nodeWidth = bandWidth + bandFlowGap

    const layout = useMemo<LaidOutGraph | null>(() => {
        if (nodes.length === 0 || width <= 0 || height <= 0) return null

        const sourceNodeSet = new Set(links.map((l) => l.source))
        const targetNodeSet = new Set(links.map((l) => l.target))

        // d3-sankey hasn't run yet, so node columns aren't known here; derive
        // them from the link sets instead. Nodes in a middle column would
        // otherwise reserve space on both outer margins.
        const nodeSides = new Map(
            nodes.map((n) => [
                n.id,
                getNodeSideFromLinks({
                    isLinkSource: sourceNodeSet.has(n.id),
                    isLinkTarget: targetNodeSet.has(n.id),
                }),
            ])
        )
        const leftNodes = nodes.filter((n) => nodeSides.get(n.id) === "left")
        const rightNodes = nodes.filter((n) => nodeSides.get(n.id) === "right")

        // The outer headings start and end at the chart's edges and run
        // towards the middle, over the chart if need be, so they reserve no
        // room of their own
        const leftLabelWidth = measureMaxLabelWidth(leftNodes, fontSettings)
        const rightLabelWidth = measureMaxLabelWidth(rightNodes, fontSettings)

        // To prevent the first and last label to overflow
        const verticalLabelPadding = getSankeyVerticalLabelPadding(fontSettings)

        const headingHeight = getColumnHeadingsHeight(
            columnHeadings,
            fontSettings
        )

        const resolvedInnerMargin: Margin = {
            top:
                Math.max(
                    verticalLabelPadding,
                    innerMargin?.top ?? DEFAULT_MARGIN.top
                ) + headingHeight,
            bottom: Math.max(
                verticalLabelPadding,
                innerMargin?.bottom ?? DEFAULT_MARGIN.bottom
            ),
            left: Math.max(
                leftLabelWidth > 0 ? leftLabelWidth + BAND_LABEL_GAP : 0,
                innerMargin?.left ?? DEFAULT_MARGIN.left
            ),
            right: Math.max(
                rightLabelWidth > 0 ? rightLabelWidth + BAND_LABEL_GAP : 0,
                innerMargin?.right ?? DEFAULT_MARGIN.right
            ),
        }
        const resolvedMargin = {
            top: margin.top + resolvedInnerMargin.top,
            bottom: margin.bottom + resolvedInnerMargin.bottom,
            left: margin.left + resolvedInnerMargin.left,
            right: margin.right + resolvedInnerMargin.right,
        }

        if (resolvedMargin.top + resolvedMargin.bottom >= height) {
            height += resolvedMargin.top + resolvedMargin.bottom
        }

        const generator = d3Sankey<SankeyLayoutNode, SankeyLink>()
            .nodeId((d) => d.id)
            .nodeWidth(nodeWidth)
            .nodePadding(nodePadding)
            .nodeSort(null) // Sort by input order
            .linkSort(null) // Sort by input order
            .extent([
                [resolvedMargin.left, resolvedMargin.top],
                [width - resolvedMargin.right, height - resolvedMargin.bottom],
            ])
            .iterations(anchorNodeId ? 0 : 32) // Skip relaxation if anchored

        // Shallow-clone nodes and links because d3 mutates its input
        const result = generator({
            nodes: nodes.map((n) => ({ ...n })),
            links: links.map((l) => ({ ...l })),
        })

        // Pin the named node to the top of its column by shifting it
        // (and its connected link endpoints) up by however much
        // d3-sankey pushed it down.
        if (anchorNodeId) {
            const node = result.nodes.find((n) => n.id === anchorNodeId)
            if (
                node &&
                node.y0 !== undefined &&
                node.y1 !== undefined &&
                node.y0 > resolvedMargin.top
            ) {
                const dy = resolvedMargin.top - node.y0
                shiftNodeVertically(node, dy)
            }
        }

        return result
    }, [
        nodes,
        links,
        width,
        height,
        nodeWidth,
        nodePadding,
        margin,
        anchorNodeId,
        innerMargin,
        fontSettings,
        columnHeadings,
    ])

    const labels = useMemo<PlacedSankeyLabel[]>(
        () =>
            placeSankeyLabels({
                layout,
                nodePadding,
                fontSettings,
                middleLabelSide,
            }),
        [layout, nodePadding, fontSettings, middleLabelSide]
    )

    const headings = useMemo<PlacedColumnHeading[]>(
        () =>
            placeColumnHeadings({
                layout,
                candidates: [
                    ...(columnHeadings ? [columnHeadings] : []),
                    ...(columnHeadingFallbacks ?? []),
                ],
                fontSettings,
                top: margin.top,
                left: margin.left,
                right: width - margin.right,
            }),
        [
            layout,
            columnHeadings,
            columnHeadingFallbacks,
            fontSettings,
            margin.top,
            margin.left,
            margin.right,
            width,
        ]
    )

    const svgRef = useRef<SVGSVGElement>(null)

    const [rawHover, setHover] = useState<HoverState | null>(null)
    const dismissTooltip = useCallback(() => setHover(null), [])

    // A hovered node or link belongs to the layout it was found in. When the
    // graph changes underneath a resting cursor (e.g. a click navigated to a
    // new selection), the stale hover would describe a flow that no longer
    // exists, so treat it as no hover until the next mouse move.
    const hover = useMemo<HoverState | null>(() => {
        if (!rawHover || !layout) return null
        const isCurrent = match(rawHover)
            .with({ kind: "link" }, (h) => layout.links.includes(h.link))
            .with({ kind: "node" }, (h) => layout.nodes.includes(h.node))
            .exhaustive()
        return isCurrent ? rawHover : null
    }, [rawHover, layout])
    const { ref: containerRef, isPinned } = usePinnedTooltip<HTMLDivElement>(
        hover !== null,
        dismissTooltip
    )

    const onSvgMouseMove = useCallback(
        (event: React.MouseEvent<SVGSVGElement>) => {
            if (!svgRef.current || !layout) return
            const mouse = getRelativeMouse(svgRef.current, event.nativeEvent)
            if (getNodeTooltip) {
                const node = findNodeAtPoint({
                    nodes: layout.nodes,
                    labels,
                    mouseX: mouse.x,
                    mouseY: mouse.y,
                    isHoverable: isNodeHoverable,
                })
                if (node) {
                    setHover({
                        kind: "node",
                        node,
                        position: { x: mouse.x, y: mouse.y },
                    })
                    return
                }
            }
            if (getLinkTooltip) {
                const link = findLinkAtPoint({
                    links: layout.links,
                    mouseX: mouse.x,
                    mouseY: mouse.y,
                })
                if (link) {
                    setHover({
                        kind: "link",
                        link,
                        position: { x: mouse.x, y: mouse.y },
                    })
                    return
                }
            }
            setHover(null)
        },
        [getLinkTooltip, getNodeTooltip, isNodeHoverable, labels, layout]
    )

    const onSvgMouseLeave = useCallback(() => setHover(null), [])

    const onSvgClick = useCallback(
        (event: React.MouseEvent<SVGSVGElement>) => {
            if (isPinned) return // Disable on touch devices
            if (!svgRef.current || !layout) return
            const mouse = getRelativeMouse(svgRef.current, event.nativeEvent)
            if (onNodeClick) {
                const node = findNodeAtPoint({
                    nodes: layout.nodes,
                    labels,
                    mouseX: mouse.x,
                    mouseY: mouse.y,
                    isHoverable: isNodeClickable,
                })
                if (node) {
                    onNodeClick(toNodeData(node))
                    return
                }
            }
            if (onLinkClick) {
                const link = findLinkAtPoint({
                    links: layout.links,
                    mouseX: mouse.x,
                    mouseY: mouse.y,
                })
                if (link) {
                    const linkData = toLinkData(link)
                    if (!isLinkClickable || isLinkClickable(linkData))
                        onLinkClick(linkData)
                }
            }
        },
        [
            isPinned,
            layout,
            labels,
            onNodeClick,
            isNodeClickable,
            onLinkClick,
            isLinkClickable,
        ]
    )

    /**
     * Links related to the hovered link or node that should be highlighted
     * with it, e.g. the continuation of a flow in the next column
     */
    const hoverRelatedLinks = useMemo<LaidOutLink[]>(() => {
        if (!hover || !layout) return []

        const relatedData = match(hover)
            .with({ kind: "link" }, (h) =>
                getRelatedLinks ? getRelatedLinks(toLinkData(h.link)) : []
            )
            .with({ kind: "node" }, (h) =>
                getRelatedLinksForNode
                    ? getRelatedLinksForNode({
                          node: toNodeData(h.node),
                          incomingLinks: (h.node.targetLinks ?? []).map(
                              toLinkData
                          ),
                          outgoingLinks: (h.node.sourceLinks ?? []).map(
                              toLinkData
                          ),
                      })
                    : []
            )
            .exhaustive()

        if (relatedData.length === 0) return []

        const relatedKeys = new Set(relatedData.map((l) => makeLinkKey(l)))

        return layout.links.filter((l) =>
            relatedKeys.has(makeLinkKey(toLinkData(l)))
        )
    }, [hover, getRelatedLinks, getRelatedLinksForNode, layout])

    const activeLinks = useMemo(() => {
        if (!hover) return new Set<LaidOutLink>()

        const set = new Set<LaidOutLink>()
        match(hover)
            .with({ kind: "link" }, (hover) => {
                // Highlight the hovered link and any related links
                set.add(hover.link)
                for (const l of hoverRelatedLinks) set.add(l)
            })
            .with({ kind: "node" }, (hover) => {
                // Node hover lights up every link touching this node, and
                // wherever those flows continue
                for (const l of hover.node.sourceLinks ?? []) set.add(l)
                for (const l of hover.node.targetLinks ?? []) set.add(l)
                for (const l of hoverRelatedLinks) set.add(l)
            })
            .exhaustive()

        return set
    }, [hover, hoverRelatedLinks])

    const activeNodeIds = useMemo(() => {
        if (!hover) return new Set<string>()

        const ids = new Set<string>()

        // Highlight nodes connected to the hovered link
        for (const link of activeLinks) {
            ids.add(makeNodeId(link.source))
            ids.add(makeNodeId(link.target))
        }

        // Highlight the hovered node itself
        if (hover.kind === "node") ids.add(hover.node.id)

        return ids
    }, [hover, activeLinks])

    // Re-order links so that active links render last so they paint on top
    // of unfocused ribbons
    const linksInRenderOrder = useMemo<LaidOutLink[]>(() => {
        if (!layout) return []

        // No need to reorder
        if (activeLinks.size === 0) return layout.links

        const inactive: LaidOutLink[] = []
        const active: LaidOutLink[] = []
        for (const l of layout.links) {
            if (activeLinks.has(l)) active.push(l)
            else inactive.push(l)
        }
        return [...inactive, ...active]
    }, [layout, activeLinks])

    if (!layout) return null

    const hoveredNodeId = hover?.kind === "node" ? hover.node.id : undefined
    const hoveredLink = hover?.kind === "link" ? hover.link : undefined
    const linkBundles = bundleParallelLinks(
        linksInRenderOrder,
        (link) => link === hoveredLink || activeLinks.has(link)
    )

    // Use the wrapper div's dimensions, not the SVG's: the SVG can be
    // shorter than its grid cell (SplitFlowSankey shrinks one half to
    // equalize scale), which would clip the tooltip near the bottom edge
    const containerEl = containerRef.current
    const tooltipBounds = containerEl
        ? { width: containerEl.clientWidth, height: containerEl.clientHeight }
        : { width, height }

    const tooltip: SankeyTooltip | undefined = match(hover)
        .with({ kind: "link" }, ({ link }) =>
            getLinkTooltip?.({ link: toLinkData(link) })
        )
        .with({ kind: "node" }, ({ node }) =>
            getNodeTooltip?.({
                node: toNodeData(node),
                incomingLinks: (node.targetLinks ?? []).map(toLinkData),
                outgoingLinks: (node.sourceLinks ?? []).map(toLinkData),
            })
        )
        .with(null, () => undefined)
        .exhaustive()

    // Show pointer cursor only when the cursor is over a clickable node or link
    const isOverClickableNode =
        !!onNodeClick &&
        hover?.kind === "node" &&
        (!isNodeClickable || isNodeClickable(toNodeData(hover.node)))
    const isOverClickableLink =
        !!onLinkClick &&
        hover?.kind === "link" &&
        (!isLinkClickable || isLinkClickable(toLinkData(hover.link)))

    return (
        <div ref={containerRef} className="sankey-container">
            <svg
                ref={svgRef}
                className="sankey"
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                onMouseMove={onSvgMouseMove}
                onMouseLeave={onSvgMouseLeave}
                onClick={onNodeClick || onLinkClick ? onSvgClick : undefined}
                style={
                    isOverClickableNode || isOverClickableLink
                        ? { cursor: "pointer" }
                        : undefined
                }
            >
                <g className="sankey__links">
                    {linkBundles.map((bundle) => (
                        <SankeyLinkView
                            key={makeLinkKey(toLinkData(bundle[0]))}
                            links={bundle}
                            linkColor={linkColor}
                            isHovered={
                                hoveredLink !== undefined &&
                                bundle.includes(hoveredLink)
                            }
                            isActive={activeLinks.has(bundle[0])}
                            totalFlowVolume={totalFlowVolume}
                            linkLowVolumeThreshold={
                                canFadeLowVolumeLink?.(
                                    toLinkData(bundle[0])
                                ) === false
                                    ? undefined
                                    : linkLowVolumeThreshold
                            }
                        />
                    ))}
                </g>
                <g className="sankey__nodes">
                    {layout.nodes.map((node) => (
                        <SankeyNodeView
                            key={node.id}
                            node={node}
                            bandWidth={bandWidth}
                            nodeColor={nodeColor}
                            isHovered={hoveredNodeId === node.id}
                            isActive={activeNodeIds.has(node.id)}
                            isAnchored={node.id === anchorNodeId}
                        />
                    ))}
                </g>
                {headings.length > 0 && (
                    <g className="sankey__column-headings">
                        {headings.map((heading) => (
                            <text
                                key={heading.columnIndex}
                                className="sankey__column-heading"
                                x={heading.x}
                                y={
                                    heading.y +
                                    fontSettings.fontSize *
                                        COLUMN_HEADING_BASELINE_EM
                                }
                                textAnchor={heading.textAnchor}
                                fontSize={fontSettings.fontSize}
                                fontWeight={COLUMN_HEADING_FONT_WEIGHT}
                            >
                                {heading.parts.map((part, i) =>
                                    part.emphasis ? (
                                        <tspan
                                            key={i}
                                            className="sankey__column-heading-emphasis"
                                            fontWeight={
                                                COLUMN_HEADING_EMPHASIS_FONT_WEIGHT
                                            }
                                        >
                                            {part.text}
                                        </tspan>
                                    ) : (
                                        <tspan key={i}>{part.text}</tspan>
                                    )
                                )}
                            </text>
                        ))}
                    </g>
                )}
                <g className="sankey__labels">
                    {labels.map((label, i) => (
                        <SankeyLabel
                            key={i}
                            label={label}
                            isHovered={hoveredNodeId === label.nodeId}
                            isActive={activeNodeIds.has(label.nodeId)}
                            isAnchored={label.nodeId === anchorNodeId}
                        />
                    ))}
                </g>
            </svg>
            {hover && tooltip && (
                <TooltipCard
                    id="sankey-tooltip"
                    x={hover.position.x}
                    y={hover.position.y}
                    offsetX={8}
                    offsetY={8}
                    style={{ maxWidth: "340px" }}
                    title={tooltip.title}
                    subtitle={tooltip.subtitle}
                    anchor={isPinned ? GrapherTooltipAnchor.Bottom : undefined}
                    containerBounds={isPinned ? undefined : tooltipBounds}
                >
                    {tooltip.content}
                </TooltipCard>
            )}
        </div>
    )
}

/**
 * Groups parallel links — the same two nodes, told apart only by their
 * category — so each group is drawn as one ribbon. Drawn separately,
 * neighbouring translucent ribbons leave anti-aliasing seams between them.
 * Highlighted and plain links are grouped apart, so a highlight still picks
 * out its own; a plain group may then span a highlighted link between two of
 * its own, which is fine since highlighted links are opaque and drawn later.
 * Keeps the given render order, a group taking the place of its first member.
 */
function bundleParallelLinks(
    links: LaidOutLink[],
    isHighlighted: (link: LaidOutLink) => boolean
): LaidOutLink[][] {
    const bundles = new Map<string, LaidOutLink[]>()
    for (const link of links) {
        const key = [
            makeNodeId(link.source),
            makeNodeId(link.target),
            isHighlighted(link),
        ].join("|")
        const bundle = bundles.get(key)
        if (bundle) bundle.push(link)
        else bundles.set(key, [link])
    }
    return [...bundles.values()]
}

/** One ribbon for one link, or for a bundle of parallel ones */
function SankeyLinkView({
    links,
    linkColor,
    isHovered,
    isActive,
    totalFlowVolume,
    linkLowVolumeThreshold,
}: {
    links: LaidOutLink[]
    linkColor?: (link: SankeyLink) => string
    isHovered?: boolean
    isActive?: boolean
    totalFlowVolume?: number
    linkLowVolumeThreshold?: number
}): React.ReactElement | null {
    const path = makeSankeyRibbonPath(links)
    if (!path) return null

    const color = linkColor?.(toLinkData(links[0])) ?? GRAPHER_DENIM

    const value = links.reduce((sum, link) => sum + link.value, 0)
    const isLowVolume =
        totalFlowVolume &&
        linkLowVolumeThreshold &&
        value / totalFlowVolume < linkLowVolumeThreshold

    const className = cx("sankey__link", {
        "sankey__link--hovered": isHovered,
        "sankey__link--active": isActive,
        "sankey__link--low-volume": isLowVolume,
    })

    return <path className={className} d={path} fill={color} />
}

// d3-sankey builds a single curved centerline for each link, and the visible band is a thick stroke around it.
// This works well for thin links, but for wider, bendy links it can result in messy-looking ribbons and overlaps.
// Instead, we build a filled ribbon. This keeps large links from visually spilling over neighboring ribbons on sharp bends.
// Parallel links (all between the same two nodes) make one ribbon spanning
// all of theirs.
function makeSankeyRibbonPath(links: LaidOutLink[]): string | null {
    const sourceNode = links[0].source as LaidOutNode
    const targetNode = links[0].target as LaidOutNode

    if (sourceNode.x1 === undefined || targetNode.x0 === undefined) return null
    // A middle node's band spans its full width and touches its ribbons, so
    // tuck their ends under it: edge to edge, anti-aliasing would leave a
    // hairline between the two
    const x0 =
        sourceNode.x1 -
        (getNodeSide(sourceNode) === "middle" ? RIBBON_NODE_OVERLAP : 0)
    const x1 =
        targetNode.x0 +
        (getNodeSide(targetNode) === "middle" ? RIBBON_NODE_OVERLAP : 0)

    let y0Top = Infinity
    let y0Bottom = -Infinity
    let y1Top = Infinity
    let y1Bottom = -Infinity
    for (const link of links) {
        const width = link.width ?? 0
        if (link.y0 === undefined || link.y1 === undefined || width <= 0)
            continue
        const halfWidth = Math.max(0.25, width / 2)
        y0Top = Math.min(y0Top, link.y0 - halfWidth)
        y0Bottom = Math.max(y0Bottom, link.y0 + halfWidth)
        y1Top = Math.min(y1Top, link.y1 - halfWidth)
        y1Bottom = Math.max(y1Bottom, link.y1 + halfWidth)
    }
    if (y0Top === Infinity) return null

    const xi = (x0 + x1) / 2

    return [
        `M${x0},${y0Top}`, // start point: left top
        `C${xi},${y0Top},${xi},${y1Top},${x1},${y1Top}`, // top curve to right top
        `L${x1},${y1Bottom}`, // line to right bottom
        `C${xi},${y1Bottom},${xi},${y0Bottom},${x0},${y0Bottom}`, // bottom curve to left bottom
        "Z", // close path back to start
    ].join("")
}

function SankeyNodeView({
    node,
    bandWidth,
    nodeColor,
    isHovered,
    isActive,
    isAnchored,
}: {
    node: LaidOutNode
    bandWidth: number
    nodeColor?: (node: SankeyNode) => string
    isHovered?: boolean
    isActive?: boolean
    isAnchored?: boolean
}): React.ReactElement {
    const x0 = node.x0 ?? 0
    const x1 = node.x1 ?? 0
    const y0 = node.y0 ?? 0
    const y1 = node.y1 ?? 0
    // A node too small to see still gets a hairline, centred on it: its links
    // are drawn at least that thick, and without the band a middle node's
    // ribbons would visibly break off on either side of it
    const h = Math.max(MIN_NODE_DRAWN_HEIGHT, y1 - y0)
    const y = (y0 + y1 - h) / 2

    // Middle-column nodes have no outer edge to hug, so their band spans the
    // node's full width
    const side = getNodeSide(node)
    const x = side === "right" ? x1 - bandWidth : x0
    const w = side === "middle" ? Math.max(0, x1 - x0) : bandWidth

    const fill = nodeColor?.(node) ?? GRAPHER_DENIM

    const className = cx("sankey__node", {
        "sankey__node--hovered": isHovered,
        "sankey__node--active": isActive,
        "sankey__node--anchored": isAnchored,
    })

    return (
        <rect
            className={className}
            x={x}
            y={y}
            width={w}
            height={h}
            fill={fill}
        />
    )
}

function SankeyLabel({
    label,
    isHovered,
    isActive,
    isAnchored,
}: {
    label: PlacedSankeyLabel
    isHovered?: boolean
    isActive?: boolean
    isAnchored?: boolean
}): React.ReactElement {
    const className = cx("sankey__label", {
        "sankey__label--inner": label.side === "middle",
        "sankey__label--hovered": isHovered,
        "sankey__label--active": isActive,
        "sankey__label--anchored": isAnchored,
    })

    // The icon always sits nearest the node's band, with the text after it
    const isTextAnchoredAtEnd = label.textAnchor === "end"
    const textOffset = getIconLabelOffset(label)
    const textX = isTextAnchoredAtEnd
        ? label.x - textOffset
        : label.x + textOffset

    // The icon sits on a white disc so it stays legible over the ribbons
    const iconX = isTextAnchoredAtEnd ? label.x - SANKEY_ICON_SIZE : label.x
    const iconY = label.y - 0.5 * SANKEY_ICON_SIZE
    const icon =
        label.icon && label.isIconVisible ? (
            <>
                <circle
                    className="sankey__label-icon-backing"
                    cx={iconX + 0.5 * SANKEY_ICON_SIZE}
                    cy={label.y}
                    r={0.5 * SANKEY_ICON_SIZE + ICON_BACKING_PADDING}
                />
                <svg
                    className="sankey__label-icon"
                    x={iconX}
                    y={iconY}
                    width={SANKEY_ICON_SIZE}
                    height={SANKEY_ICON_SIZE}
                    viewBox={`0 0 ${SANKEY_ICON_SIZE} ${SANKEY_ICON_SIZE}`}
                >
                    {label.icon}
                </svg>
            </>
        ) : null

    if (label.valueLabel) {
        const labelY =
            label.y - 0.5 * label.label.height - 0.5 * VALUE_LABEL_GAP
        const valueLabelY = labelY + label.label.height + VALUE_LABEL_GAP

        return (
            <g className={className}>
                {icon}
                <TextWrapSvg
                    textWrap={label.label}
                    x={textX}
                    y={labelY}
                    textAnchor={label.textAnchor}
                    fill={GRAPHER_DARK_TEXT}
                />
                <TextWrapSvg
                    textWrap={label.valueLabel}
                    x={textX}
                    y={valueLabelY}
                    textAnchor={label.textAnchor}
                    fill={GRAPHER_LIGHT_TEXT}
                />
            </g>
        )
    }

    return (
        <g className={className}>
            {icon}
            <TextWrapSvg
                textWrap={label.label}
                x={textX}
                y={label.y}
                textAnchor={label.textAnchor}
                fill={GRAPHER_DARK_TEXT}
            />
        </g>
    )
}

function placeSankeyLabels({
    layout,
    nodePadding,
    fontSettings,
    middleLabelSide,
}: {
    layout: LaidOutGraph | null
    nodePadding: number
    fontSettings: FontSettings
    middleLabelSide: "left" | "right"
}): PlacedSankeyLabel[] {
    if (!layout) return []

    return layout.nodes.flatMap((node) => {
        const { label, valueLabel, icon } = node

        const x0 = node.x0 ?? 0
        const x1 = node.x1 ?? 0
        const y0 = node.y0 ?? 0
        const y1 = node.y1 ?? 0
        const nodeHeight = y1 - y0

        // Middle-column labels sit to the right of the node, like right-column
        // ones, but over the ribbons rather than in an outer margin
        // Outer labels sit in the outer margins; middle-column labels lie over
        // the ribbons on whichever side the caller prefers
        const side = getNodeSide(node)
        const labelSide = side === "middle" ? middleLabelSide : side
        const x =
            labelSide === "left" ? x0 - BAND_LABEL_GAP : x1 + BAND_LABEL_GAP
        const y = (y0 + y1) / 2
        const textAnchor = labelSide === "left" ? "end" : "start"

        // An icon needs its own height between neighbouring nodes; on a node
        // too short for it, hide it rather than let it overlap the next label.
        // The text keeps the icon's space either way, so a column's labels
        // line up.
        const nodeHeightWithPadding = nodeHeight + nodePadding
        const isIconVisible = nodeHeightWithPadding >= SANKEY_ICON_SIZE

        const labelTextWrap = new TextWrap({
            ...fontSettings,
            text: label,
            maxWidth: Infinity,
            verticalAlign: VerticalAlign.middle,
            fontWeight: 700,
        })

        if (valueLabel) {
            const valueLabelTextWrap = new TextWrap({
                ...fontSettings,
                text: valueLabel,
                maxWidth: Infinity,
                verticalAlign: VerticalAlign.middle,
            })

            const totalLabelHeight =
                labelTextWrap.height +
                valueLabelTextWrap.height +
                VALUE_LABEL_GAP

            const shouldShowValueLabel =
                nodeHeightWithPadding >= totalLabelHeight

            return [
                {
                    nodeId: node.id,
                    x,
                    y,
                    textAnchor,
                    side,
                    label: labelTextWrap,
                    valueLabel: shouldShowValueLabel
                        ? valueLabelTextWrap
                        : undefined,
                    icon,
                    isIconVisible,
                },
            ]
        } else {
            return [
                {
                    nodeId: node.id,
                    x,
                    y,
                    textAnchor,
                    side,
                    label: labelTextWrap,
                    icon,
                    isIconVisible,
                },
            ]
        }
    })
}

function toColumnHeadingParts(
    heading: SankeyColumnHeading | undefined
): SankeyColumnHeadingPart[] {
    if (heading === undefined) return []
    if (typeof heading === "string") return heading ? [{ text: heading }] : []
    return heading.filter((part) => part.text)
}

/** Width of a heading's text, part by part since emphasis changes the weight */
function measureColumnHeadingWidth(
    parts: SankeyColumnHeadingPart[],
    fontSettings: FontSettings
): number {
    let width = 0
    for (const part of parts)
        width += textWidth(part.text, {
            ...fontSettings,
            fontWeight: part.emphasis
                ? COLUMN_HEADING_EMPHASIS_FONT_WEIGHT
                : COLUMN_HEADING_FONT_WEIGHT,
        })
    return width
}

/** Vertical space the column headings take above the chart, 0 without any */
function getColumnHeadingsHeight(
    columnHeadings: SankeyColumnHeading[] | undefined,
    fontSettings: FontSettings
): number {
    if (!columnHeadings?.some((h) => toColumnHeadingParts(h).length > 0))
        return 0
    return fontSettings.fontSize * fontSettings.lineHeight + COLUMN_HEADING_GAP
}

/**
 * One heading per column. The outer ones sit at the chart's edges — the left
 * one starting at the left edge, so a sentence spread over the columns
 * begins where the eye starts, the right one ending at the right edge; a
 * middle one is centred over its column's bands.
 *
 * `candidates` are heading sets in order of preference; the first whose
 * headings fit side by side wins. If none fits, the last one is drawn with
 * overlapping headings pushed apart, keeping them inside the chart's edges
 * for as long as they fit at all.
 */
function placeColumnHeadings({
    layout,
    candidates,
    fontSettings,
    top,
    left,
    right,
}: {
    layout: LaidOutGraph | null
    candidates: SankeyColumnHeading[][]
    fontSettings: FontSettings
    top: number
    left: number
    right: number
}): PlacedColumnHeading[] {
    if (!layout || candidates.length === 0) return []

    const depths = [...new Set(layout.nodes.map((n) => n.depth ?? 0))].toSorted(
        (a, b) => a - b
    )

    type Measured = PlacedColumnHeading & { start: number; end: number }
    const place = (columnHeadings: SankeyColumnHeading[]): Measured[] =>
        depths.flatMap((depth, columnIndex) => {
            const parts = toColumnHeadingParts(columnHeadings[columnIndex])
            const node = layout.nodes.find((n) => (n.depth ?? 0) === depth)
            if (parts.length === 0 || !node) return []

            const side = getNodeSide(node)
            const x0 = node.x0 ?? 0
            const x1 = node.x1 ?? 0
            const placement = match(side)
                .returnType<Pick<PlacedColumnHeading, "x" | "textAnchor">>()
                .with("left", () => ({ x: left, textAnchor: "start" }))
                .with("middle", () => ({
                    x: (x0 + x1) / 2,
                    textAnchor: "middle",
                }))
                .with("right", () => ({ x: right, textAnchor: "end" }))
                .exhaustive()
            const width = measureColumnHeadingWidth(parts, fontSettings)
            const start = match(placement.textAnchor)
                .with("start", () => placement.x)
                .with("middle", () => placement.x - width / 2)
                .with("end", () => placement.x - width)
                .exhaustive()
            return [
                {
                    columnIndex,
                    parts,
                    y: top,
                    ...placement,
                    start,
                    end: start + width,
                },
            ]
        })

    const fits = (headings: Measured[]): boolean =>
        headings.every(
            (h, i) =>
                h.start >= left &&
                h.end <= right &&
                (i === 0 ||
                    h.start >= headings[i - 1].end + COLUMN_HEADING_MIN_SPACING)
        )

    const attempts = candidates.map(place)
    const fitting = attempts.find(fits)
    const chosen = fitting ?? attempts.at(-1) ?? []

    // Resolve overlaps left to right: a heading starts no earlier than the
    // previous one ends, plus a gap
    const shifts = chosen.map(() => 0)
    for (let i = 1; i < chosen.length; i++) {
        const previousEnd = chosen[i - 1].end + shifts[i - 1]
        const overlap =
            previousEnd + COLUMN_HEADING_MIN_SPACING - chosen[i].start
        shifts[i] = Math.max(0, overlap)
    }
    // Then right to left, pulling back whatever that pushed past the right
    // edge, without pushing any heading past the left edge
    let nextStart = right + COLUMN_HEADING_MIN_SPACING
    for (let i = chosen.length - 1; i >= 0; i--) {
        const heading = chosen[i]
        const excess =
            heading.end + shifts[i] - (nextStart - COLUMN_HEADING_MIN_SPACING)
        if (excess > 0)
            shifts[i] -= Math.min(excess, heading.start + shifts[i] - left)
        nextStart = heading.start + shifts[i]
    }
    return chosen.map((heading, i) => ({
        columnIndex: heading.columnIndex,
        parts: heading.parts,
        x: heading.x + shifts[i],
        y: heading.y,
        textAnchor: heading.textAnchor,
    }))
}

function shiftNodeVertically(node: LaidOutNode, dy: number): void {
    // Update node position
    node.y0 = (node.y0 ?? 0) + dy
    node.y1 = (node.y1 ?? 0) + dy

    // Update connected link endpoints
    for (const link of node.targetLinks ?? []) {
        if (link.y1 !== undefined) link.y1 += dy
    }
    for (const link of node.sourceLinks ?? []) {
        if (link.y0 !== undefined) link.y0 += dy
    }
}

/**
 * Which column a laid-out node sits in. d3-sankey gives every node a `depth`
 * (columns to its left) and a `height` (columns to its right), so a node with
 * columns on both sides is a middle one.
 */
function getNodeSide(node: LaidOutNode): SankeyNodeSide {
    const depth = node.depth ?? 0
    const height = node.height ?? 0
    if (depth > 0 && height > 0) return "middle"
    return depth <= height ? "left" : "right"
}

/**
 * Which column a node sits in, derived from whether it appears as a link
 * source, a link target, or both. Used where node depths aren't available
 * yet, i.e. before d3-sankey has laid the graph out.
 *
 * Returns undefined for a node without any links, which sits in no column.
 */
export function getNodeSideFromLinks({
    isLinkSource,
    isLinkTarget,
}: {
    isLinkSource: boolean
    isLinkTarget: boolean
}): SankeyNodeSide | undefined {
    if (isLinkSource && isLinkTarget) return "middle"
    if (isLinkSource) return "left"
    if (isLinkTarget) return "right"
    return undefined
}

function makeNodeId(
    endpoint: LaidOutLink["source"] | LaidOutLink["target"]
): string {
    if (typeof endpoint === "string" || typeof endpoint === "number")
        return String(endpoint)
    return (endpoint as SankeyLayoutNode).id
}

function makeLinkKey({
    source,
    target,
    category,
}: Pick<SankeyLink, "source" | "target" | "category">): string {
    const key = `${source}->${target}`
    return category === undefined ? key : `${key}#${category}`
}

function toLinkData(link: LaidOutLink): SankeyLink {
    const l = link
    return {
        source: makeNodeId(link.source),
        target: makeNodeId(link.target),
        value: l.value,
        category: l.category,
    }
}

function toNodeData(node: LaidOutNode): SankeyNode {
    return {
        id: node.id,
        label: node.label,
        valueLabel: node.valueLabel,
        icon: node.icon,
    }
}

const measureMaxLabelWidth = (
    nodes: SankeyNode[],
    fontSettings: FontSettings
): number =>
    Math.max(
        0,
        ...nodes.map((n) => measureMaxLabelWidthForNode(n, fontSettings))
    )

export function measureMaxLabelWidthForNode(
    node: SankeyNode,
    fontSettings: FontSettings
): number {
    return (
        Math.max(
            textWidth(node.label, fontSettings),
            node.valueLabel ? textWidth(node.valueLabel, fontSettings) : 0
        ) + getIconLabelOffset(node)
    )
}

/** Horizontal space an icon takes up ahead of its label text, if any */
function getIconLabelOffset(node: { icon?: React.ReactNode }): number {
    return node.icon ? SANKEY_ICON_SIZE + SANKEY_ICON_TEXT_GAP : 0
}

function textWidth(text: string, fontSettings: FontSettings): number {
    return Bounds.forText(text, fontSettings).width
}

/**
 * Per-side label margin Sankey reserves at the top and bottom of the inner
 * SVG to prevent the first/last labels from overflowing the chart bounds
 */
export function getSankeyVerticalLabelPadding(
    fontSettings: FontSettings
): number {
    return 0.5 * fontSettings.fontSize * fontSettings.lineHeight
}

/**
 * Find the hoverable node whose hit shape (band ∪ label, merged into the
 * enclosing rect) the cursor is over, or the nearest such shape within
 * tolerance. Returns null when no node is within range.
 */
function findNodeAtPoint({
    nodes,
    labels,
    mouseX,
    mouseY,
    isHoverable,
}: {
    nodes: LaidOutNode[]
    labels: PlacedSankeyLabel[]
    mouseX: number
    mouseY: number
    isHoverable?: (node: SankeyNode) => boolean
}): LaidOutNode | null {
    const labelByNodeId = new Map(labels.map((l) => [l.nodeId, l]))
    const mouse = new PointVector(mouseX, mouseY)

    let closest: { node: LaidOutNode; dist: number } | null = null
    for (const node of nodes) {
        if (isHoverable && !isHoverable(node)) continue
        const bounds = calculateNodeHitBounds(node, labelByNodeId.get(node.id))
        const dist = bounds.distanceToPoint(mouse)
        if (dist > NODE_HIT_TOLERANCE) continue
        if (!closest || dist < closest.dist) closest = { node, dist }
    }

    return closest?.node ?? null
}

function calculateNodeHitBounds(
    node: LaidOutNode,
    label?: PlacedSankeyLabel
): Bounds {
    const bandBounds = Bounds.fromCorners(
        new PointVector(node.x0 ?? 0, node.y0 ?? 0),
        new PointVector(node.x1 ?? 0, node.y1 ?? 0)
    )
    if (!label) return bandBounds

    const width =
        Math.max(label.label.width, label.valueLabel?.width ?? 0) +
        getIconLabelOffset(label)
    const textHeight =
        label.label.height +
        (label.valueLabel ? VALUE_LABEL_GAP + label.valueLabel.height : 0)
    const height = label.icon
        ? Math.max(textHeight, SANKEY_ICON_SIZE)
        : textHeight

    const labelX = label.textAnchor === "end" ? label.x - width : label.x
    const labelBounds = new Bounds(labelX, label.y - height / 2, width, height)

    return Bounds.merge([bandBounds, labelBounds])
}

/**
 * Find the laid-out link the mouse is over (or nearest to), or null if no
 * link is within tolerance. Combines two signals so hover stays continuous
 * across both wide and thin ribbons:
 *  - Inside a band: distance-from-band-edge collapses to 0 → that link wins.
 *  - In the slim gap between ribbons: distance-from-edge grows from 0, but
 *    stays under the tolerance so the nearer ribbon stays hovered. Without
 *    this, strict band-membership would briefly hover nothing as the
 *    cursor traverses the gap, flickering the tooltip.
 *  - Overlapping bands or ties: break by closer centerline.
 */
function findLinkAtPoint({
    links,
    mouseX,
    mouseY,
}: {
    links: LaidOutLink[]
    mouseX: number
    mouseY: number
}): LaidOutLink | null {
    let closest: { link: LaidOutLink; gap: number; dy: number } | null = null
    for (const link of links) {
        const centerY = calculateLinkCenterY(link, mouseX)
        if (centerY === null) continue
        const dy = Math.abs(mouseY - centerY)
        const halfBand = (link.width ?? 0) / 2
        const gap = Math.max(0, dy - halfBand)
        if (gap > LINK_BAND_GAP_TOLERANCE) continue
        if (
            !closest ||
            gap < closest.gap ||
            (gap === closest.gap && dy < closest.dy)
        ) {
            closest = { link, gap, dy }
        }
    }
    return closest?.link ?? null
}

/**
 * Centerline y at a given x along a d3-sankey horizontal link, or null when
 * x is outside the link's horizontal extent.
 *
 * `sankeyLinkHorizontal` draws a cubic Bezier
 *   M x0,y0 C xi,y0  xi,y1  x1,y1     (xi = (x0+x1)/2)
 * so x(t) is cubic in t and we bisect for the t matching `mouseX`. The
 * y curve simplifies to a smoothstep blend between y0 and y1.
 */
function calculateLinkCenterY(
    link: LaidOutLink,
    mouseX: number
): number | null {
    const sourceNode = link.source as LaidOutNode
    const targetNode = link.target as LaidOutNode
    const x0 = sourceNode.x1 ?? 0 // right edge of source node = link start
    const x1 = targetNode.x0 ?? 0 // left edge of target node  = link end
    if (mouseX < x0 || mouseX > x1) return null

    const y0 = link.y0 ?? 0
    const y1 = link.y1 ?? 0
    if (x1 === x0) return (y0 + y1) / 2

    const xi = (x0 + x1) / 2
    const xAt = (t: number): number =>
        (1 - t) ** 3 * x0 + 3 * t * (1 - t) * xi + t ** 3 * x1

    let lo = 0
    let hi = 1
    for (let i = 0; i < 12; i++) {
        const mid = (lo + hi) / 2
        if (xAt(mid) < mouseX) lo = mid
        else hi = mid
    }
    const t = (lo + hi) / 2
    const s = t * t * (3 - 2 * t) // smoothstep
    return y0 + (y1 - y0) * s
}
