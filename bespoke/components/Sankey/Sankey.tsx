import React, { useCallback, useMemo, useRef, useState } from "react"
import {
    sankey as d3Sankey,
    sankeyLinkHorizontal,
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
import cx from "classnames"
import { usePinnedTooltip } from "../../hooks/usePinnedTooltip.js"
import { match } from "ts-pattern"

/* Horizontal gap between a node's edge and its label */
export const BAND_LABEL_GAP = 6

/** Vertical gap between a node's value label and its label */
const VALUE_LABEL_GAP = 2

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
    nodeColor?: (node: SankeyNode) => string
    linkColor?: (link: SankeyLink) => string
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
    getNodeTooltip?: (args: NodeTooltipArgs) => SankeyTooltip | undefined
    getLinkTooltip?: (args: LinkTooltipArgs) => SankeyTooltip | undefined
    onNodeClick?: (node: SankeyNode) => void
    isNodeClickable?: (node: SankeyNode) => boolean
    isNodeHoverable?: (node: SankeyNode) => boolean
    /** Other links to be highlighted as a group with the hovered one */
    getRelatedLinks?: (link: SankeyLink) => SankeyLink[]
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
}

export type SankeyLink = {
    source: string
    target: string
    value: number
}

/** Which side of a link (or, equivalently, which column of the chart). */
export type LinkSide = "source" | "target"

type PlacedSankeyLabel = {
    nodeId: string
    x: number
    y: number
    textAnchor: "start" | "end"
    label: TextWrap
    valueLabel?: TextWrap
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
    nodeColor,
    linkColor,
    margin = DEFAULT_MARGIN,
    innerMargin,
    anchorNodeId,
    nodePadding = 12,
    bandWidth = 4,
    bandFlowGap = 3,
    fontSettings = DEFAULT_FONT_SETTINGS,
    getLinkTooltip,
    getRelatedLinks,
    getNodeTooltip,
    isNodeHoverable,
    onNodeClick,
    isNodeClickable,
}: SankeyProps): React.ReactElement | null {
    const nodeWidth = bandWidth + bandFlowGap

    const layout = useMemo<LaidOutGraph | null>(() => {
        if (nodes.length === 0 || width <= 0 || height <= 0) return null

        const sourceNodeSet = new Set(links.map((l) => l.source))
        const targetNodeSet = new Set(links.map((l) => l.target))

        const sourceNodes = nodes.filter((n) => sourceNodeSet.has(n.id))
        const targetNodes = nodes.filter((n) => targetNodeSet.has(n.id))

        const leftLabelWidth = measureMaxLabelWidth(sourceNodes, fontSettings)
        const rightLabelWidth = measureMaxLabelWidth(targetNodes, fontSettings)

        // To prevent the first and last label to overflow
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

        if (resolvedMargin.top + resolvedMargin.bottom >= height) {
            height += resolvedMargin.top + resolvedMargin.bottom
        }

        const generator = d3Sankey<SankeyLayoutNode, SankeyLink>()
            .nodeId((d) => d.id)
            .nodeWidth(nodeWidth)
            .nodePadding(nodePadding)
            .nodeSort(null) // Sort by input order
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
    ])

    const linkPath = sankeyLinkHorizontal<SankeyNode, SankeyLink>()

    const labels = useMemo<PlacedSankeyLabel[]>(
        () => placeSankeyLabels({ layout, nodePadding, fontSettings }),
        [layout, nodePadding, fontSettings]
    )

    const svgRef = useRef<SVGSVGElement>(null)

    const [hover, setHover] = useState<HoverState | null>(null)
    const dismissTooltip = useCallback(() => setHover(null), [])
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
            if (!svgRef.current || !layout || !onNodeClick) return
            const mouse = getRelativeMouse(svgRef.current, event.nativeEvent)
            const node = findNodeAtPoint({
                nodes: layout.nodes,
                labels,
                mouseX: mouse.x,
                mouseY: mouse.y,
                isHoverable: isNodeClickable,
            })
            if (node) onNodeClick(toNodeData(node))
        },
        [layout, labels, onNodeClick, isNodeClickable]
    )

    /** Links related to the hovered link that should also be highlighted */
    const hoverRelatedLinks = useMemo<LaidOutLink[]>(() => {
        if (!hover || hover.kind !== "link" || !getRelatedLinks || !layout)
            return []

        const relatedData = getRelatedLinks(toLinkData(hover.link))

        if (relatedData.length === 0) return []

        const relatedKeys = new Set(
            relatedData.map((l) => makeLinkKey(l.source, l.target))
        )

        return layout.links.filter((l) =>
            relatedKeys.has(
                makeLinkKey(makeNodeId(l.source), makeNodeId(l.target))
            )
        )
    }, [hover, getRelatedLinks, layout])

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
                // Node hover lights up every link touching this node
                for (const l of hover.node.sourceLinks ?? []) set.add(l)
                for (const l of hover.node.targetLinks ?? []) set.add(l)
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

    // Show pointer cursor only when the cursor is over a clickable node.
    // Relies on the hover state already tracking node-under-cursor (which
    // assumes clickable nodes are also hoverable — true for our consumers).
    const isOverClickableNode =
        !!onNodeClick &&
        hover?.kind === "node" &&
        (!isNodeClickable || isNodeClickable(toNodeData(hover.node)))

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
                onClick={onNodeClick ? onSvgClick : undefined}
                style={isOverClickableNode ? { cursor: "pointer" } : undefined}
            >
                <g className="sankey__links">
                    {linksInRenderOrder.map((link) => (
                        <SankeyLink
                            key={makeLinkKey(
                                makeNodeId(link.source),
                                makeNodeId(link.target)
                            )}
                            link={link}
                            linkPath={linkPath}
                            linkColor={linkColor}
                            isHovered={hoveredLink === link}
                            isActive={activeLinks.has(link)}
                        />
                    ))}
                </g>
                <g className="sankey__nodes">
                    {layout.nodes.map((node) => (
                        <SankeyNode
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

function SankeyLink({
    link,
    linkPath,
    linkColor,
    isHovered,
    isActive,
}: {
    link: LaidOutLink
    linkPath: (link: LaidOutLink) => string | null
    linkColor?: (link: SankeyLink) => string
    isHovered?: boolean
    isActive?: boolean
}): React.ReactElement | null {
    const path = linkPath(link)
    if (!path) return null

    const color = linkColor?.(toLinkData(link)) ?? GRAPHER_DENIM
    const width = Math.max(0.5, link.width ?? 0)

    const className = cx("sankey__link", {
        "sankey__link--hovered": isHovered,
        "sankey__link--active": isActive,
    })

    return (
        <path
            className={className}
            d={path}
            stroke={color}
            strokeWidth={width}
        />
    )
}

function SankeyNode({
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
    const h = Math.max(0, y1 - y0)

    const isLeftSide = isNodeOnLeftSide(node)
    const x = isLeftSide ? x0 : x1 - bandWidth

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
            y={y0}
            width={bandWidth}
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
        "sankey__label--hovered": isHovered,
        "sankey__label--active": isActive,
        "sankey__label--anchored": isAnchored,
    })

    if (label.valueLabel) {
        const labelY =
            label.y - 0.5 * label.label.height - 0.5 * VALUE_LABEL_GAP
        const valueLabelY = labelY + label.label.height + VALUE_LABEL_GAP

        return (
            <g className={className}>
                <TextWrapSvg
                    textWrap={label.label}
                    x={label.x}
                    y={labelY}
                    textAnchor={label.textAnchor}
                    fill={GRAPHER_DARK_TEXT}
                />
                <TextWrapSvg
                    textWrap={label.valueLabel}
                    x={label.x}
                    y={valueLabelY}
                    textAnchor={label.textAnchor}
                    fill={GRAPHER_LIGHT_TEXT}
                />
            </g>
        )
    }

    return (
        <g className={className}>
            <TextWrapSvg
                textWrap={label.label}
                x={label.x}
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
}: {
    layout: LaidOutGraph | null
    nodePadding: number
    fontSettings: FontSettings
}): PlacedSankeyLabel[] {
    if (!layout) return []

    return layout.nodes.flatMap((node) => {
        const { label, valueLabel } = node

        const x0 = node.x0 ?? 0
        const x1 = node.x1 ?? 0
        const y0 = node.y0 ?? 0
        const y1 = node.y1 ?? 0
        const nodeHeight = y1 - y0

        const isLeftSide = isNodeOnLeftSide(node)
        const x = isLeftSide ? x0 - BAND_LABEL_GAP : x1 + BAND_LABEL_GAP
        const y = (y0 + y1) / 2
        const textAnchor = isLeftSide ? "end" : "start"

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

            const nodeHeightWithPadding = nodeHeight + nodePadding
            const shouldShowValueLabel =
                nodeHeightWithPadding >= totalLabelHeight

            return [
                {
                    nodeId: node.id,
                    x,
                    y,
                    textAnchor,
                    label: labelTextWrap,
                    valueLabel: shouldShowValueLabel
                        ? valueLabelTextWrap
                        : undefined,
                },
            ]
        } else {
            return [
                {
                    nodeId: node.id,
                    x,
                    y,
                    textAnchor,
                    label: labelTextWrap,
                },
            ]
        }
    })
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

function isNodeOnLeftSide(node: LaidOutNode): boolean {
    return (node.depth ?? 0) <= (node.height ?? 0)
}

function makeNodeId(
    endpoint: LaidOutLink["source"] | LaidOutLink["target"]
): string {
    if (typeof endpoint === "string" || typeof endpoint === "number")
        return String(endpoint)
    return (endpoint as SankeyLayoutNode).id
}

function makeLinkKey(source: string, target: string): string {
    return `${source}->${target}`
}

function toLinkData(link: LaidOutLink): SankeyLink {
    const l = link as SankeyLink & LaidOutLink
    return {
        source: makeNodeId(link.source),
        target: makeNodeId(link.target),
        value: l.value,
    }
}

function toNodeData(node: LaidOutNode): SankeyNode {
    return {
        id: node.id,
        label: node.label,
        valueLabel: node.valueLabel,
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
    return Math.max(
        textWidth(node.label, fontSettings),
        node.valueLabel ? textWidth(node.valueLabel, fontSettings) : 0
    )
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

    const width = Math.max(label.label.width, label.valueLabel?.width ?? 0)
    const height =
        label.label.height +
        (label.valueLabel ? VALUE_LABEL_GAP + label.valueLabel.height : 0)

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
