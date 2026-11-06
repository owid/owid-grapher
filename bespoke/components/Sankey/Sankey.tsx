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
    BezierArrow,
    GRAPHER_DARK_TEXT,
    GRAPHER_DENIM,
    GRAPHER_LIGHT_TEXT,
    type FontSettings,
} from "@ourworldindata/grapher"
import { TooltipCard } from "@ourworldindata/grapher/src/tooltip/TooltipCard.js"
import type { FooterItem } from "@ourworldindata/grapher/src/tooltip/TooltipProps.js"
import { TextWrap, TextWrapSvg } from "@ourworldindata/components"
import cx from "clsx"
import { usePinnedTooltip } from "../../hooks/usePinnedTooltip.js"
import { match } from "ts-pattern"

/** Horizontal gap between a node's edge and its label */
export const BAND_LABEL_GAP = 6

/** Width and height of a node's optional icon, drawn next to its label */
const SANKEY_ICON_SIZE = 16

/** Horizontal gap between a node's icon and its label text */
const SANKEY_ICON_TEXT_GAP = 8

/** Size of an inline icon, which reads as part of the label's first line */
const INLINE_ICON_SIZE = 14

/** Horizontal gap between an inline icon and the label text it leads */
const INLINE_ICON_TEXT_GAP = 6

/** How far the white disc behind an icon extends past the icon's box */
const ICON_BACKING_PADDING = 2

/** Vertical gap between a node's value label and its label */
const VALUE_LABEL_GAP = 2

/** Vertical gap above an annotation, where its arrow runs up to the band */
const ANNOTATION_GAP = 30

/** Where under the annotation its arrow starts, as a share of the text's
 *  width from the band's side */
const ANNOTATION_ARROW_START_SHARE = 0.4
/** How far above the annotation's top the arrow meets the band */
const ANNOTATION_ARROW_RISE = 11
const ANNOTATION_ARROWHEAD_SIZE = 5
/** Space between the arrowhead's tip and the band */
const ANNOTATION_ARROW_BAND_GAP = 3

/** How far a ribbon reaches under a middle node's band, in px */
const RIBBON_NODE_OVERLAP = 0.5

/** Smallest height a node's band is drawn at, however small its value */
const MIN_NODE_DRAWN_HEIGHT = 1

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
    mergeParallelLinks?: boolean
    /** Allows low-volume links to fade; defaults to true for all links. */
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
    /**
     * By default a middle node's band spans the node's full width and the
     * ribbons on both sides run into it. When set, the band is drawn at this
     * width, centred, with the ribbons stopping `gap` px short of it.
     */
    middleBand?: MiddleBand
    fontSettings?: FontSettings
    /** Widest a tooltip may grow, in px */
    tooltipMaxWidth?: number
    /** Side of a middle node's band to place labels over the ribbons; defaults to right. */
    middleLabelSide?: "left" | "right"
    /**
     * Only show a middle node's label where it fits on the node's own ribbons
     * on its side; where it doesn't, fall back to its name without the value
     * line, then to just its icon, then to nothing, whichever fits first. For labels drawn in a colour that only reads
     * against their ribbon.
     */
    fitMiddleLabelsToRibbons?: boolean
    getNodeTooltip?: (args: NodeTooltipArgs) => SankeyTooltip | undefined
    getLinkTooltip?: (args: LinkTooltipArgs) => SankeyTooltip | undefined
    onNodeClick?: (node: SankeyNode) => void
    isNodeClickable?: (node: SankeyNode) => boolean
    isNodeHoverable?: (node: SankeyNode) => boolean
    onLinkClick?: (link: SankeyLink) => void
    isLinkClickable?: (link: SankeyLink) => boolean
    /** Other links to be highlighted as a group with the hovered one */
    getRelatedLinks?: (link: SankeyLink) => SankeyLink[]
    /** Additional links to highlight on node hover, beyond its incoming and outgoing links. */
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
    /** Shown at the right of the tooltip's header, e.g. an icon */
    headerAside?: React.ReactNode
    content: React.ReactNode
    /** Small print under the content, such as a definition */
    footer?: FooterItem[]
}

export type SankeyNode = {
    id: string
    label: string
    valueLabel?: string
    /** Note below the value with an arrow to the band; hidden unless all three lines fit. */
    annotation?: string
    annotationFontSize?: number
    /**
     * The ways to label the node, best first: the Sankey draws the first one
     * that fits (see `placeSankeyLabels`), and no label if none does.
     * Defaults to the node's `label`, `valueLabel` and `annotation`, then
     * the same without the annotation, then without the value.
     */
    labelVariants?: SankeyLabelVariant[]
    /** Colour of the label and value text. Outer labels default to dark
     *  text with a lighter value line. Middle-column labels lie over the
     *  ribbons, so they must set a colour picked to read against them. */
    labelColor?: string
    /** Colour of the label while any of the ribbons under it is
     *  highlighted, and so drawn opaque; defaults to `labelColor` */
    highlightedLabelColor?: string
}

export type SankeyLink = {
    source: string
    target: string
    value: number
    /** Distinguishes parallel links for rendering, coloring, and highlighting. */
    category?: string
}

export type LinkSide = "source" | "target"

export type SankeyIconStyle = "badge" | "inline"

/** One way to label a node */
export type SankeyLabelVariant = {
    /** Omit, or leave empty, for a variant that is just the icon */
    label?: string
    valueLabel?: string
    annotation?: string
    /** SVG content for a `0 0 16 16` viewBox */
    icon?: React.ReactNode
    /**
     * How the icon goes with the label, between the band and the text: as a
     * badge on a white disc centred on the label (the default), or inline, as
     * a small glyph beside the label's first line. Either way an icon
     * without text sits by the band, centred on the node.
     */
    iconStyle?: SankeyIconStyle
}

/** A node's position relative to the outer columns. */
export type SankeyNodeSide = "left" | "right" | "middle"

type PlacedSankeyLabel = {
    nodeId: string
    x: number
    y: number
    textAnchor: "start" | "end"
    side: SankeyNodeSide
    label: TextWrap
    valueLabel?: TextWrap
    annotation?: TextWrap
    icon?: React.ReactNode
    iconStyle?: SankeyIconStyle
    labelColor?: string
    highlightedLabelColor?: string
    /** Hidden icons still reserve horizontal space to keep labels aligned. */
    isIconVisible: boolean
    /** The variant is just the icon, shown by the band */
    isIconOnly?: boolean
}

type Margin = { top: number; right: number; bottom: number; left: number }

type MiddleBand = { width: number; gap: number }

type LaidOutGraph = SankeyGraph<SankeyNode, SankeyLink>
type LaidOutNode = D3SankeyNode<SankeyNode, SankeyLink>
type LaidOutLink = D3SankeyLink<SankeyNode, SankeyLink>

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
    mergeParallelLinks = false,
    margin = DEFAULT_MARGIN,
    innerMargin,
    anchorNodeId,
    nodePadding = 12,
    bandWidth = 4,
    bandFlowGap = 3,
    middleBand,
    fontSettings = DEFAULT_FONT_SETTINGS,
    tooltipMaxWidth = 340,
    middleLabelSide = "right",
    fitMiddleLabelsToRibbons = false,
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

    const layoutResult = useMemo<{
        graph: LaidOutGraph
        height: number
    } | null>(() => {
        if (nodes.length === 0 || width <= 0 || height <= 0) return null

        const sourceNodeSet = new Set(links.map((l) => l.source))
        const targetNodeSet = new Set(links.map((l) => l.target))

        // Infer columns before layout so middle nodes don't reserve outer label margins.
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

        const leftLabelWidth = measureMaxLabelWidth(leftNodes, fontSettings)
        const rightLabelWidth = measureMaxLabelWidth(rightNodes, fontSettings)

        // Keep the first and last labels within the chart bounds.
        const verticalLabelPadding = getSankeyVerticalLabelPadding(fontSettings)

        const resolvedInnerMargin: Margin = {
            top: Math.max(
                verticalLabelPadding,
                innerMargin?.top ?? DEFAULT_MARGIN.top
            ),
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

        // Grow the chart if the margins alone would take up all of its height
        const layoutHeight =
            resolvedMargin.top + resolvedMargin.bottom >= height
                ? height + resolvedMargin.top + resolvedMargin.bottom
                : height

        const generator = d3Sankey<SankeyNode, SankeyLink>()
            .nodeId((d) => d.id)
            .nodeWidth(nodeWidth)
            .nodePadding(nodePadding)
            .nodeSort(null) // Sort by input order
            .linkSort(null) // Sort by input order
            .extent([
                [resolvedMargin.left, resolvedMargin.top],
                [
                    width - resolvedMargin.right,
                    layoutHeight - resolvedMargin.bottom,
                ],
            ])
            .iterations(anchorNodeId ? 0 : 32) // Skip relaxation if anchored

        // Shallow-clone nodes and links because d3 mutates its input
        const result = generator({
            nodes: nodes.map((n) => ({ ...n })),
            links: links.map((l) => ({ ...l })),
        })

        // Move the anchor and its link endpoints to the top of the column.
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

        return { graph: result, height: layoutHeight }
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
    ])
    const layout = layoutResult?.graph ?? null
    const svgHeight = layoutResult?.height ?? height

    const labels = useMemo<PlacedSankeyLabel[]>(
        () =>
            placeSankeyLabels({
                layout,
                nodePadding,
                fontSettings,
                middleLabelSide,
                fitMiddleLabelsToRibbons,
                middleBand,
            }),
        [
            layout,
            nodePadding,
            fontSettings,
            middleLabelSide,
            fitMiddleLabelsToRibbons,
            middleBand,
        ]
    )

    const nodesById = useMemo(
        () => new Map((layout?.nodes ?? []).map((n) => [n.id, n])),
        [layout]
    )

    // Only annotated labels use their node's colour (for the arrow)
    const getLabelNodeColor = (nodeId: string): string | undefined => {
        const node = nodesById.get(nodeId)
        return node?.annotation ? nodeColor?.(node) : undefined
    }

    const svgRef = useRef<SVGSVGElement>(null)

    const [rawHover, setHover] = useState<HoverState | null>(null)
    const dismissTooltip = useCallback(() => setHover(null), [])

    // Discard stale hover state when the layout changes under a stationary cursor.
    const hover = useMemo<HoverState | null>(() => {
        if (!rawHover || !layout) return null
        const isCurrent = match(rawHover)
            .with({ kind: "link" }, (h) => layout.links.includes(h.link))
            .with({ kind: "node" }, (h) => layout.nodes.includes(h.node))
            .exhaustive()
        return isCurrent ? rawHover : null
    }, [rawHover, layout])
    const hoveredNodeId = hover?.kind === "node" ? hover.node.id : undefined
    const { ref: containerRef, isPinned } = usePinnedTooltip<HTMLDivElement>(
        hover !== null,
        dismissTooltip
    )

    // The wrapper can be taller than the SVG in SplitFlowSankey; use its
    // bounds so tooltips can extend into that space.
    const [containerSize, setContainerSize] = useState<{
        width: number
        height: number
    } | null>(null)

    const onSvgMouseMove = useCallback(
        (event: React.MouseEvent<SVGSVGElement>) => {
            if (!svgRef.current || !layout) return
            const containerEl = containerRef.current
            if (containerEl) {
                const width = containerEl.clientWidth
                const height = containerEl.clientHeight
                setContainerSize((prev) =>
                    prev?.width === width && prev.height === height
                        ? prev
                        : { width, height }
                )
            }
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
                    middleBand,
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
        [
            containerRef,
            getLinkTooltip,
            getNodeTooltip,
            isNodeHoverable,
            labels,
            layout,
            middleBand,
        ]
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
                    middleBand,
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
            middleBand,
            layout,
            labels,
            onNodeClick,
            isNodeClickable,
            onLinkClick,
            isLinkClickable,
        ]
    )

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
                set.add(hover.link)
                for (const l of hoverRelatedLinks) set.add(l)
            })
            .with({ kind: "node" }, (hover) => {
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

        for (const link of activeLinks) {
            ids.add(makeNodeId(link.source))
            ids.add(makeNodeId(link.target))
        }

        if (hover.kind === "node") ids.add(hover.node.id)

        return ids
    }, [hover, activeLinks])

    // A middle node's band spans all of its ribbons, so when only some of
    // them are lit it would stand out against the faded rest, crossing the
    // lit ribbons; it's only highlighted when all of its links are
    const highlightedBandNodeIds = useMemo(() => {
        const ids = new Set<string>()
        for (const node of layout?.nodes ?? []) {
            if (!activeNodeIds.has(node.id)) continue
            const isFullyLit =
                getNodeSide(node) !== "middle" ||
                node.id === hoveredNodeId ||
                [
                    ...(node.sourceLinks ?? []),
                    ...(node.targetLinks ?? []),
                ].every((l) => activeLinks.has(l))
            if (isFullyLit) ids.add(node.id)
        }
        return ids
    }, [layout, activeNodeIds, activeLinks, hoveredNodeId])

    // The ribbons each middle label lies over, which decide its colour
    const linksUnderLabel = useMemo(() => {
        const map = new Map<string, LaidOutLink[]>()
        for (const label of labels) {
            // Only labels that change colour on highlight need their ribbons
            if (
                label.side !== "middle" ||
                label.highlightedLabelColor === undefined
            )
                continue
            const node = nodesById.get(label.nodeId)
            const sideLinks =
                label.textAnchor === "end"
                    ? node?.targetLinks
                    : node?.sourceLinks
            map.set(
                label.nodeId,
                findLinksUnderBox(
                    getLabelBounds(label),
                    sideLinks ?? [],
                    middleBand
                )
            )
        }
        return map
    }, [labels, nodesById, middleBand])

    // A label with any lit ribbon under it sits at least partly on opaque
    // colour, where its regular colour wouldn't read, so it takes the
    // highlighted colour even over the faded rest
    const labelIdsOnHighlightedRibbons = useMemo(() => {
        const ids = new Set<string>()
        if (activeLinks.size === 0) return ids
        for (const [nodeId, links] of linksUnderLabel)
            if (links.some((l) => activeLinks.has(l))) ids.add(nodeId)
        return ids
    }, [linksUnderLabel, activeLinks])

    // Paint active links last so they appear above inactive ribbons.
    const linksInRenderOrder = useMemo<LaidOutLink[]>(() => {
        if (!layout) return []

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

    const hoveredLink = hover?.kind === "link" ? hover.link : undefined
    const linkBundles = mergeParallelLinks
        ? bundleParallelLinks(linksInRenderOrder, (link) =>
              activeLinks.has(link)
          )
        : linksInRenderOrder.map((link) => [link])

    const tooltipBounds = containerSize ?? { width, height: svgHeight }

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
                height={svgHeight}
                viewBox={`0 0 ${width} ${svgHeight}`}
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
                            middleBand={middleBand}
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
                            middleBand={middleBand}
                            nodeColor={nodeColor}
                            isHovered={hoveredNodeId === node.id}
                            isActive={highlightedBandNodeIds.has(node.id)}
                            isAnchored={node.id === anchorNodeId}
                        />
                    ))}
                </g>
                <g className="sankey__labels">
                    {labels.map((label, i) => (
                        <SankeyLabel
                            key={i}
                            label={label}
                            isHovered={hoveredNodeId === label.nodeId}
                            isActive={activeNodeIds.has(label.nodeId)}
                            isOnHighlightedRibbons={labelIdsOnHighlightedRibbons.has(
                                label.nodeId
                            )}
                            isAnchored={label.nodeId === anchorNodeId}
                            nodeColor={getLabelNodeColor(label.nodeId)}
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
                    style={{ maxWidth: `${tooltipMaxWidth}px` }}
                    title={tooltip.title}
                    subtitle={tooltip.subtitle}
                    headerAside={tooltip.headerAside}
                    footer={tooltip.footer}
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
 * Merge parallel links to avoid anti-aliasing seams between translucent ribbons.
 * Keep highlighted links separate: they render opaquely over inactive bundles,
 * which may span the gaps occupied by highlighted links. Each bundle retains
 * the render position of its first member.
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
    middleBand,
    linkColor,
    isHovered,
    isActive,
    totalFlowVolume,
    linkLowVolumeThreshold,
}: {
    links: LaidOutLink[]
    middleBand?: MiddleBand
    linkColor?: (link: SankeyLink) => string
    isHovered?: boolean
    isActive?: boolean
    totalFlowVolume?: number
    linkLowVolumeThreshold?: number
}): React.ReactElement | null {
    const path = makeSankeyRibbonPath(links, middleBand)
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

// Filled ribbons avoid the overlaps that thick centerline strokes create on
// sharp bends. A bundle spans the outer edges of all its parallel links.
function makeSankeyRibbonPath(
    links: LaidOutLink[],
    middleBand?: MiddleBand
): string | null {
    const geometry = toRibbonGeometry(links[0], middleBand)
    if (!geometry) return null
    const { x0, x1 } = geometry

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
    middleBand,
    nodeColor,
    isHovered,
    isActive,
    isAnchored,
}: {
    node: LaidOutNode
    bandWidth: number
    middleBand?: MiddleBand
    nodeColor?: (node: SankeyNode) => string
    isHovered?: boolean
    isActive?: boolean
    isAnchored?: boolean
}): React.ReactElement {
    const x0 = node.x0 ?? 0
    const x1 = node.x1 ?? 0
    const y0 = node.y0 ?? 0
    const y1 = node.y1 ?? 0
    // Keep tiny nodes visible so their incoming and outgoing ribbons stay connected.
    const h = Math.max(MIN_NODE_DRAWN_HEIGHT, y1 - y0)
    const y = (y0 + y1 - h) / 2

    // Middle-node bands span the full width to connect ribbons on both
    // sides, unless they're drawn narrower and centred
    const side = getNodeSide(node)
    const w =
        side !== "middle"
            ? bandWidth
            : middleBand
              ? Math.min(middleBand.width, x1 - x0)
              : Math.max(0, x1 - x0)
    const x =
        side === "right"
            ? x1 - bandWidth
            : side === "middle"
              ? (x0 + x1 - w) / 2
              : x0

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
    isOnHighlightedRibbons,
    isAnchored,
    nodeColor = GRAPHER_DENIM,
}: {
    label: PlacedSankeyLabel
    isHovered?: boolean
    isActive?: boolean
    /** Any of the ribbons under the label is highlighted */
    isOnHighlightedRibbons?: boolean
    isAnchored?: boolean
    /** The node band's colour, which an annotation and its arrow take on */
    nodeColor?: string
}): React.ReactElement {
    const className = cx("sankey__label", {
        "sankey__label--colored": label.labelColor !== undefined,
        "sankey__label--hovered": isHovered,
        "sankey__label--active": isActive,
        "sankey__label--anchored": isAnchored,
    })

    const labelColor = isOnHighlightedRibbons
        ? (label.highlightedLabelColor ?? label.labelColor)
        : label.labelColor

    // The icon sits nearest the node's band, with the text after it
    const isTextAnchoredAtEnd = label.textAnchor === "end"
    const directionAway = isTextAnchoredAtEnd ? -1 : 1
    const textOffset = getIconWidth(label)
    const textX = label.x + directionAway * textOffset

    // An inline icon lines up with the label's first line, or, shown without
    // its text, with the node; either way it's in the same column by the band
    const isInlineIcon = label.iconStyle === "inline"
    const iconSize = getIconSize(label)
    const firstLineCenterY =
        label.y - 0.5 * getLabelTextHeight(label) + 0.5 * label.label.height
    const iconX = isTextAnchoredAtEnd ? label.x - iconSize : label.x
    const iconCenterY =
        isInlineIcon && !label.isIconOnly ? firstLineCenterY : label.y
    const icon =
        label.icon && label.isIconVisible ? (
            <>
                {/* A badge sits on a white disc so it stays legible over
                    the ribbons */}
                {!isInlineIcon && (
                    <circle
                        className="sankey__label-icon-backing"
                        cx={iconX + 0.5 * iconSize}
                        cy={iconCenterY}
                        r={0.5 * iconSize + ICON_BACKING_PADDING}
                    />
                )}
                <svg
                    className="sankey__label-icon"
                    x={iconX}
                    y={iconCenterY - 0.5 * iconSize}
                    width={iconSize}
                    height={iconSize}
                    viewBox={`0 0 ${SANKEY_ICON_SIZE} ${SANKEY_ICON_SIZE}`}
                >
                    {label.icon}
                </svg>
            </>
        ) : null

    if (label.isIconOnly)
        return (
            <g className={className} color={labelColor}>
                {icon}
            </g>
        )

    // The label's lines stack, centred as a block on the node
    const lines = [
        { textWrap: label.label, fill: labelColor ?? GRAPHER_DARK_TEXT },
        ...(label.valueLabel
            ? [
                  {
                      textWrap: label.valueLabel,
                      fill: labelColor ?? GRAPHER_LIGHT_TEXT,
                  },
              ]
            : []),
        ...(label.annotation
            ? [
                  {
                      textWrap: label.annotation,
                      fill: nodeColor,
                      className: "sankey__label-annotation",
                  },
              ]
            : []),
    ]
    let lineTop = label.y - 0.5 * getLabelTextHeight(label)

    const directionToBand = -directionAway

    return (
        // An icon drawn in `currentColor` follows the label's colour
        <g className={className} color={labelColor}>
            {icon}
            {lines.map(({ textWrap, fill, className }, i) => {
                if (textWrap === label.annotation)
                    lineTop += ANNOTATION_GAP - VALUE_LABEL_GAP
                const y = lineTop + 0.5 * textWrap.height
                lineTop += textWrap.height + VALUE_LABEL_GAP
                if (textWrap !== label.annotation)
                    return (
                        <TextWrapSvg
                            key={i}
                            textWrap={textWrap}
                            x={textX}
                            y={y}
                            textAnchor={label.textAnchor}
                            fill={fill}
                        />
                    )

                // Curve upward from the annotation, meeting the band horizontally.
                const annotationX = textX
                const arrowStart = {
                    x:
                        annotationX -
                        directionToBand *
                            ANNOTATION_ARROW_START_SHARE *
                            textWrap.width,
                    y: y - 0.5 * textWrap.height - 1,
                }
                const arrowEnd = {
                    x:
                        label.x +
                        directionToBand *
                            (BAND_LABEL_GAP - ANNOTATION_ARROW_BAND_GAP),
                    y: y - 0.5 * textWrap.height - ANNOTATION_ARROW_RISE,
                }
                const dx = Math.abs(arrowEnd.x - arrowStart.x)
                const dy = arrowEnd.y - arrowStart.y
                return (
                    <g key={i} className={className}>
                        <TextWrapSvg
                            textWrap={textWrap}
                            x={annotationX}
                            y={y}
                            textAnchor={label.textAnchor}
                            fill={fill}
                        />
                        <BezierArrow
                            start={arrowStart}
                            end={arrowEnd}
                            startHandleOffset={{ x: 0, y: dy }}
                            endHandleOffset={{
                                x: -directionToBand * 0.6 * dx,
                                y: 0,
                            }}
                            headLength={ANNOTATION_ARROWHEAD_SIZE}
                            color={nodeColor}
                        />
                    </g>
                )
            })}
        </g>
    )
}

/** Height of a placed label's stacked lines of text */
function getLabelTextHeight(label: {
    label: TextWrap
    valueLabel?: TextWrap
    annotation?: TextWrap
}): number {
    const lines = [label.label, label.valueLabel, label.annotation].filter(
        (line) => line !== undefined
    )
    const linesHeight = lines.reduce((sum, line) => sum + line.height, 0)
    const annotationExtraGap = label.annotation
        ? ANNOTATION_GAP - VALUE_LABEL_GAP
        : 0
    return (
        linesHeight + VALUE_LABEL_GAP * (lines.length - 1) + annotationExtraGap
    )
}

/**
 * Place each node's label: the first of its variants that fits, or none.
 *
 * A variant fits when it fits the node's height (padding included): a
 * single line of text always does, more lines must stack within it, and an
 * icon alone must be no taller. With `fitMiddleLabelsToRibbons`, a middle
 * label must also lie entirely on the node's own ribbons on its side.
 */
function placeSankeyLabels({
    layout,
    nodePadding,
    fontSettings,
    middleLabelSide,
    fitMiddleLabelsToRibbons,
    middleBand,
}: {
    layout: LaidOutGraph | null
    nodePadding: number
    fontSettings: FontSettings
    middleLabelSide: "left" | "right"
    fitMiddleLabelsToRibbons: boolean
    middleBand?: MiddleBand
}): PlacedSankeyLabel[] {
    if (!layout) return []

    return layout.nodes.flatMap((node) => {
        const variants = getLabelVariants(node)
        const side = getNodeSide(node)
        if (
            side === "middle" &&
            node.labelColor === undefined &&
            variants.some((v) => v.label)
        )
            console.warn(
                `Sankey: middle-column node "${node.id}" has a label but no labelColor; middle labels lie over the ribbons and need a colour that reads against them`
            )

        const nodeHeightWithPadding =
            (node.y1 ?? 0) - (node.y0 ?? 0) + nodePadding
        const anchor = getLabelAnchor(node, side, middleLabelSide)

        // A middle label lies over the node's ribbons on its side
        const ribbons =
            fitMiddleLabelsToRibbons && side === "middle"
                ? ((anchor.textAnchor === "end"
                      ? node.targetLinks
                      : node.sourceLinks
                  )?.flatMap(
                      (link) => toRibbonGeometry(link, middleBand) ?? []
                  ) ?? [])
                : undefined

        for (const variant of variants) {
            const placed = placeLabelVariant({
                node,
                variant,
                anchor,
                nodeHeightWithPadding,
                fontSettings,
            })
            // An empty label has nothing to fit
            if (placed.label.text === "" && !placed.isIconOnly) return [placed]
            if (!fitsNodeHeight(placed, nodeHeightWithPadding)) continue
            if (
                ribbons &&
                !isBoxCoveredByRibbons(getLabelBounds(placed), ribbons)
            )
                continue
            return [placed]
        }
        return []
    })
}

/** A node's label variants, best first */
function getLabelVariants(node: SankeyNode): SankeyLabelVariant[] {
    if (node.labelVariants) return node.labelVariants
    const { label, valueLabel, annotation } = node
    return [
        { label, valueLabel, annotation },
        ...(annotation ? [{ label, valueLabel }] : []),
        ...(valueLabel || annotation ? [{ label }] : []),
    ]
}

type LabelAnchor = Pick<
    PlacedSankeyLabel,
    "nodeId" | "x" | "y" | "textAnchor" | "side"
>

/** Where a node's label starts: by its band, centred on it */
function getLabelAnchor(
    node: LaidOutNode,
    side: SankeyNodeSide,
    middleLabelSide: "left" | "right"
): LabelAnchor {
    // Outer labels sit in the outer margins; middle-column labels lie over
    // the ribbons on whichever side the caller prefers
    const labelSide = side === "middle" ? middleLabelSide : side
    return {
        nodeId: node.id,
        x:
            labelSide === "left"
                ? (node.x0 ?? 0) - BAND_LABEL_GAP
                : (node.x1 ?? 0) + BAND_LABEL_GAP,
        y: ((node.y0 ?? 0) + (node.y1 ?? 0)) / 2,
        textAnchor: labelSide === "left" ? "end" : "start",
        side,
    }
}

function placeLabelVariant({
    node,
    variant,
    anchor,
    nodeHeightWithPadding,
    fontSettings,
}: {
    node: LaidOutNode
    variant: SankeyLabelVariant
    anchor: LabelAnchor
    nodeHeightWithPadding: number
    fontSettings: FontSettings
}): PlacedSankeyLabel {
    const { label = "", valueLabel, annotation, icon, iconStyle } = variant
    const isIconOnly = label === "" && icon !== undefined

    // Hide badges that would overlap adjacent labels, but preserve their
    // text offset. An inline icon sits on the label's first line, so it
    // goes wherever the label does; an icon alone is the whole label.
    const isIconVisible =
        isIconOnly ||
        iconStyle === "inline" ||
        nodeHeightWithPadding >= SANKEY_ICON_SIZE

    const makeTextWrap = (
        text: string,
        overrides?: Partial<FontSettings>
    ): TextWrap =>
        new TextWrap({
            ...fontSettings,
            ...overrides,
            text,
            maxWidth: Infinity,
            verticalAlign: VerticalAlign.middle,
        })

    return {
        ...anchor,
        label: makeTextWrap(label, { fontWeight: 700 }),
        valueLabel:
            valueLabel && !isIconOnly ? makeTextWrap(valueLabel) : undefined,
        annotation:
            annotation && !isIconOnly
                ? makeTextWrap(annotation, {
                      fontSize:
                          node.annotationFontSize ?? fontSettings.fontSize,
                  })
                : undefined,
        icon,
        iconStyle,
        labelColor: node.labelColor,
        highlightedLabelColor: node.highlightedLabelColor,
        isIconVisible,
        isIconOnly,
    }
}

/** Whether a placed label fits its node's height, padding included */
function fitsNodeHeight(
    label: PlacedSankeyLabel,
    nodeHeightWithPadding: number
): boolean {
    if (label.isIconOnly) return getIconSize(label) <= nodeHeightWithPadding
    // A single line always fits, so every node can be named
    if (!label.valueLabel && !label.annotation) return true
    return getLabelTextHeight(label) <= nodeHeightWithPadding
}

function shiftNodeVertically(node: LaidOutNode, dy: number): void {
    node.y0 = (node.y0 ?? 0) + dy
    node.y1 = (node.y1 ?? 0) + dy

    for (const link of node.targetLinks ?? []) {
        if (link.y1 !== undefined) link.y1 += dy
    }
    for (const link of node.sourceLinks ?? []) {
        if (link.y0 !== undefined) link.y0 += dy
    }
}

/** Classify nodes by their upstream depth and downstream height. */
function getNodeSide(node: LaidOutNode): SankeyNodeSide {
    const depth = node.depth ?? 0
    const height = node.height ?? 0
    if (depth > 0 && height > 0) return "middle"
    return depth <= height ? "left" : "right"
}

/** Infer a node's side before layout; unlinked nodes have no side. */
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
    return (endpoint as SankeyNode).id
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
    return {
        source: makeNodeId(link.source),
        target: makeNodeId(link.target),
        value: link.value,
        category: link.category,
    }
}

function toNodeData(node: LaidOutNode): SankeyNode {
    return {
        id: node.id,
        label: node.label,
        valueLabel: node.valueLabel,
        annotation: node.annotation,
        annotationFontSize: node.annotationFontSize,
        labelVariants: node.labelVariants,
        labelColor: node.labelColor,
        highlightedLabelColor: node.highlightedLabelColor,
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
    // Any of the variants may be drawn, so make room for the widest
    return Math.max(
        0,
        ...getLabelVariants(node).map(
            (variant) =>
                Math.max(
                    textWidth(variant.label ?? "", fontSettings),
                    variant.valueLabel
                        ? textWidth(variant.valueLabel, fontSettings)
                        : 0,
                    variant.annotation
                        ? textWidth(variant.annotation, {
                              ...fontSettings,
                              fontSize:
                                  node.annotationFontSize ??
                                  fontSettings.fontSize,
                          })
                        : 0
                ) + getIconWidth(variant)
        )
    )
}

type IconOwner = { icon?: React.ReactNode; iconStyle?: SankeyIconStyle }

/** Horizontal space an icon adds to its label, gap included */
function getIconWidth(node: IconOwner): number {
    if (!node.icon) return 0
    return node.iconStyle === "inline"
        ? INLINE_ICON_SIZE + INLINE_ICON_TEXT_GAP
        : SANKEY_ICON_SIZE + SANKEY_ICON_TEXT_GAP
}

function textWidth(text: string, fontSettings: FontSettings): number {
    return new TextWrap({ ...fontSettings, text, maxWidth: Infinity }).width
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
 * Find the nearest hoverable node within tolerance of its combined band and
 * label bounds. A middle node's label lies over the ribbons, though, where
 * the tolerance would steal hovers from the ribbons around it, so it only
 * counts when the pointer is right on it.
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
        const label = labelByNodeId.get(node.id)
        const dist =
            label?.side === "middle"
                ? Math.min(
                      calculateNodeHitBounds(node).distanceToPoint(mouse),
                      getLabelBounds(label).contains(mouse) ? 0 : Infinity
                  )
                : calculateNodeHitBounds(node, label).distanceToPoint(mouse)
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
    return Bounds.merge([bandBounds, getLabelBounds(label)])
}

/** The box a placed label's text and icon take up */
function getLabelBounds(label: PlacedSankeyLabel): Bounds {
    if (label.isIconOnly) {
        const size = getIconSize(label)
        const iconX = label.textAnchor === "end" ? label.x - size : label.x
        return new Bounds(iconX, label.y - size / 2, size, size)
    }

    const width =
        Math.max(
            label.label.width,
            label.valueLabel?.width ?? 0,
            label.annotation?.width ?? 0
        ) + getIconWidth(label)
    const textHeight = getLabelTextHeight(label)
    const hasIcon = label.icon && label.isIconVisible
    // A badge is centred on the label; an inline icon on its first line,
    // past whose top and bottom it may reach
    const height = !hasIcon
        ? textHeight
        : label.iconStyle === "inline"
          ? textHeight + Math.max(0, INLINE_ICON_SIZE - label.label.height)
          : Math.max(textHeight, SANKEY_ICON_SIZE)

    const labelX = label.textAnchor === "end" ? label.x - width : label.x
    return new Bounds(labelX, label.y - height / 2, width, height)
}

function getIconSize(node: IconOwner): number {
    return node.iconStyle === "inline" ? INLINE_ICON_SIZE : SANKEY_ICON_SIZE
}

/** A ribbon's ends: its horizontal extent and its centre line's height and
 *  thickness there */
export type RibbonGeometry = {
    x0: number
    x1: number
    y0: number
    y1: number
    width: number
}

function toRibbonGeometry(
    link: LaidOutLink,
    middleBand?: MiddleBand
): RibbonGeometry | undefined {
    const source = link.source as LaidOutNode
    const target = link.target as LaidOutNode
    if (
        source.x1 === undefined ||
        target.x0 === undefined ||
        link.y0 === undefined ||
        link.y1 === undefined
    )
        return undefined
    return {
        x0: source.x1 - getMiddleRibbonInset(source, middleBand),
        x1: target.x0 + getMiddleRibbonInset(target, middleBand),
        y0: link.y0,
        y1: link.y1,
        width: link.width ?? 0,
    }
}

/** Extend ribbons under full-width bands, or towards a narrow band's gap. */
function getMiddleRibbonInset(
    node: LaidOutNode,
    middleBand?: MiddleBand
): number {
    if (getNodeSide(node) !== "middle") return 0
    if (!middleBand) return RIBBON_NODE_OVERLAP
    const nodeWidth = (node.x1 ?? 0) - (node.x0 ?? 0)
    return Math.max(0, 0.5 * (nodeWidth - middleBand.width) - middleBand.gap)
}

/** Space a label keeps from its ribbons' edges */
const LABEL_RIBBON_PADDING = 1

/** Ribbons this close count as one, across anti-aliasing seams */
const RIBBON_SEAM_TOLERANCE = 0.5

/** Horizontal step at which a box's coverage is checked */
const COVERAGE_SAMPLE_STEP = 4

/**
 * Whether a box lies entirely on the given ribbons: at every x across it, its
 * whole height is inside the ribbons' combined thickness, with a little
 * padding. Adjacent ribbons combine; a gap between them, or the ribbons
 * ending, leaves the box uncovered there.
 */
export function isBoxCoveredByRibbons(
    box: Bounds,
    ribbons: RibbonGeometry[]
): boolean {
    const top = box.top - LABEL_RIBBON_PADDING
    const bottom = box.bottom + LABEL_RIBBON_PADDING
    const sampleCount = Math.max(1, Math.ceil(box.width / COVERAGE_SAMPLE_STEP))
    for (let i = 0; i <= sampleCount; i++) {
        const x = box.left + (i / sampleCount) * box.width
        const spans = ribbons
            .flatMap((ribbon) => {
                const centerY = calculateRibbonCenterY(ribbon, x)
                if (centerY === null || ribbon.width <= 0) return []
                const halfWidth = ribbon.width / 2
                return [[centerY - halfWidth, centerY + halfWidth]]
            })
            .sort((a, b) => a[0] - b[0])
        let isCovered = false
        let spanTop = -Infinity
        let spanBottom = -Infinity
        for (const [start, end] of spans) {
            if (start > spanBottom + RIBBON_SEAM_TOLERANCE) spanTop = start
            spanBottom = Math.max(spanBottom, end)
            if (spanTop <= top && spanBottom >= bottom) {
                isCovered = true
                break
            }
        }
        if (!isCovered) return false
    }
    return true
}

/** The links whose ribbons pass under any part of a box */
function findLinksUnderBox(
    box: Bounds,
    links: LaidOutLink[],
    middleBand?: MiddleBand
): LaidOutLink[] {
    const sampleCount = Math.max(1, Math.ceil(box.width / COVERAGE_SAMPLE_STEP))
    return links.filter((link) => {
        const ribbon = toRibbonGeometry(link, middleBand)
        if (!ribbon || ribbon.width <= 0) return false
        for (let i = 0; i <= sampleCount; i++) {
            const x = box.left + (i / sampleCount) * box.width
            const centerY = calculateRibbonCenterY(ribbon, x)
            if (centerY === null) continue
            const halfWidth = ribbon.width / 2
            if (
                centerY + halfWidth > box.top &&
                centerY - halfWidth < box.bottom
            )
                return true
        }
        return false
    })
}

/**
 * Find the nearest ribbon within tolerance of its edge, breaking ties by
 * centerline distance. The tolerance bridges small gaps to prevent tooltip flicker.
 */
function findLinkAtPoint({
    links,
    middleBand,
    mouseX,
    mouseY,
}: {
    links: LaidOutLink[]
    middleBand?: MiddleBand
    mouseX: number
    mouseY: number
}): LaidOutLink | null {
    let closest: { link: LaidOutLink; gap: number; dy: number } | null = null
    for (const link of links) {
        const ribbon = toRibbonGeometry(link, middleBand)
        if (!ribbon) continue
        const centerY = calculateRibbonCenterY(ribbon, mouseX)
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
function calculateRibbonCenterY(
    { x0, x1, y0, y1 }: RibbonGeometry,
    mouseX: number
): number | null {
    if (mouseX < x0 || mouseX > x1) return null
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
