import React, { useCallback, useMemo, useRef, useState } from "react"
import {
    sankey as d3Sankey,
    sankeyLinkHorizontal,
    SankeyGraph,
    SankeyNode as D3SankeyNode,
    SankeyLink as D3SankeyLink,
} from "d3-sankey"
import { Bounds, getRelativeMouse, VerticalAlign } from "@ourworldindata/utils"
import { GrapherTooltipAnchor } from "@ourworldindata/types"
import {
    GRAPHER_DARK_TEXT,
    GRAPHER_DENIM,
    GRAPHER_LIGHT_TEXT,
    type FontSettings,
} from "@ourworldindata/grapher"
import { TooltipCard } from "@ourworldindata/grapher/src/tooltip/TooltipCard.js"
import { TextWrap, TextWrapSvg } from "@ourworldindata/components"
import { usePinnedTooltip } from "../../hooks/usePinnedTooltip.js"

/* Horizontal gap between a node's edge and its label */
export const BAND_LABEL_GAP = 6

/** Vertical gap between a node's value label and its label */
const VALUE_LABEL_GAP = 2

/**
 * Per-side label margin Sankey reserves at the top and bottom of the inner
 * SVG to prevent the first/last labels from overflowing the chart bounds
 */
export function getSankeyVerticalLabelPadding(
    fontSettings: FontSettings
): number {
    return 0.5 * fontSettings.fontSize * fontSettings.lineHeight
}

const DEFAULT_MARGIN: Margin = { top: 0, right: 0, bottom: 0, left: 0 }

// Module-level so the prop default keeps a stable reference across renders.
// Inlining `{ fontSize: 12, ... }` in the destructure default creates a new
// object every render, which invalidates the `layout` useMemo (which depends
// on `fontSettings`), regenerates all laid-out link refs, and orphans
// `hover.link` — breaking the hovered-link highlight in any consumer that
// doesn't pass `fontSettings` explicitly (e.g. BilateralFlowSankey).
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
     * Skip d3-sankey's vertical relaxation and pin the single source or
     * sink node (when there is exactly one) to the top of its column
     */
    topAnchored?: boolean
    /** Vertical padding between nodes within a column */
    nodePadding?: number
    /** Width of each node's visible band on its outer edge */
    bandWidth?: number
    /** Whitespace between a node's band and the flow path */
    bandFlowGap?: number
    fontSettings?: FontSettings
    renderNodeTooltip?: (
        args: NodeTooltipArgs
    ) => SankeyTooltipDescriptor | null
    renderLinkTooltip?: (
        args: LinkTooltipArgs
    ) => SankeyTooltipDescriptor | null
    onNodeClick?: (node: SankeyNode) => void
    isNodeClickable?: (node: SankeyNode) => boolean
    isNodeHoverable?: (node: SankeyNode) => boolean
    /** Other links to be highlighted as a group with the hovered one */
    relatedLinks?: (link: SankeyLink) => SankeyLink[]
}

export type NodeTooltipArgs = {
    node: SankeyNode
    /** Links arriving at this node (this node is the target). Plain shape:
     *  source/target are entity IDs. */
    incomingLinks: SankeyLink[]
    /** Links leaving this node (this node is the source). */
    outgoingLinks: SankeyLink[]
}

export type LinkTooltipArgs = {
    link: SankeyLink
}

/** Content returned by a Sankey tooltip renderer. Sankey wraps this in a
 *  `<TooltipCard>` and supplies positioning, anchor, clamping, and sizing
 *  itself, so callers only think in terms of what's inside the card. */
export type SankeyTooltipDescriptor = {
    title: string
    subtitle?: string
    content: React.ReactNode
}

export type SankeyNode = {
    id: string
    label: string
    valueLabel?: string
    /** Extra class names applied to both the band <rect> and the label <g>.
     *  Lets a consumer mark special nodes (e.g. the central node in a
     *  SplitFlowSankey) so its stylesheet can keep them at full opacity
     *  while everything else dims on hover. */
    className?: string
}

export type SankeyLink = {
    source: string
    target: string
    value: number
}

type PreparedSankeyLabel = {
    nodeId: string
    nodeClassName?: string
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
    topAnchored,
    nodePadding = 12,
    bandWidth = 4,
    bandFlowGap = 3,
    fontSettings = DEFAULT_FONT_SETTINGS,
    renderLinkTooltip,
    relatedLinks,
    renderNodeTooltip,
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
            .iterations(topAnchored ? 0 : 32) // Skip relaxation if top-anchored

        // Shallow-clone nodes and links because d3 mutates its input
        const result = generator({
            nodes: nodes.map((n) => ({ ...n })),
            links: links.map((l) => ({ ...l })),
        })

        // Pin the named node to the top of its column by shifting it
        // (and its connected link endpoints) up by however much
        // d3-sankey pushed it down.
        if (topAnchored) {
            // Pinning only makes sense when there's a single source or target node
            const pinnedNodeId =
                sourceNodes.length === 1
                    ? sourceNodes[0].id
                    : targetNodes.length === 1
                      ? targetNodes[0].id
                      : undefined

            const node = result.nodes.find((n) => n.id === pinnedNodeId)
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
        topAnchored,
        innerMargin,
        fontSettings,
    ])

    const linkPath = sankeyLinkHorizontal<SankeyNode, SankeyLink>()

    const labels = useMemo<PreparedSankeyLabel[]>(
        () =>
            prepareSankeyLabels({
                layout,
                nodePadding,
                fontSettings,
            }),
        [layout, nodePadding, fontSettings]
    )

    const svgRef = useRef<SVGSVGElement>(null)
    const [hover, setHover] = useState<HoverState | null>(null)

    const dismissTooltip = useCallback(() => setHover(null), [])
    // Owns touch-device behavior for the tooltip: pins to the bottom of the
    // chart and dismisses on tap-outside or scroll-out-of-view.
    const { ref: containerRef, isPinned } = usePinnedTooltip<HTMLDivElement>(
        hover !== null,
        dismissTooltip
    )

    // SlopeChart uses a single SVG-wide mousemove and finds the nearest
    // slope within a pixel tolerance (SlopeChart.tsx:659). The Sankey
    // equivalent has a stronger membership test: each link occupies a
    // vertical band of `link.width` around a smoothstep-interpolated
    // centerline, so we just check the mouse is inside the band. Nodes
    // get a separate rect-membership test that wins over link hits
    // (their bounding boxes don't overlap with the link extent anyway).
    const onSvgMouseMove = useCallback(
        (event: React.MouseEvent<SVGSVGElement>) => {
            if (!svgRef.current || !layout) return
            const mouse = getRelativeMouse(svgRef.current, event.nativeEvent)
            if (renderNodeTooltip) {
                const node = findNodeAtPoint(
                    layout.nodes,
                    labels,
                    mouse.x,
                    mouse.y,
                    isNodeHoverable
                )
                if (node) {
                    setHover({
                        kind: "node",
                        node,
                        position: { x: mouse.x, y: mouse.y },
                    })
                    return
                }
            }
            if (renderLinkTooltip) {
                const link = findLinkAtPoint(layout.links, mouse.x, mouse.y)
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
        [renderLinkTooltip, renderNodeTooltip, isNodeHoverable, labels, layout]
    )

    const onSvgMouseLeave = useCallback(() => setHover(null), [])

    // Click hits use the same band ∪ label hit-test as hover (findNodeAtPoint),
    // so the larger label area is clickable too — labels themselves keep
    // pointer-events: none and rely on the SVG-wide handler. Filtering by
    // isNodeClickable lets consumers opt nodes out (e.g. the Other bucket).
    const onSvgClick = useCallback(
        (event: React.MouseEvent<SVGSVGElement>) => {
            if (!svgRef.current || !layout || !onNodeClick) return
            const mouse = getRelativeMouse(svgRef.current, event.nativeEvent)
            const node = findNodeAtPoint(
                layout.nodes,
                labels,
                mouse.x,
                mouse.y,
                isNodeClickable
            )
            if (node) onNodeClick(toNodeData(node))
        },
        [layout, labels, onNodeClick, isNodeClickable]
    )

    // Optional grouping (e.g. BilateralFlowSankey promotes a link hover to
    // "all links of this exporter"). The hovered link + its related siblings
    // form one active set; their union of endpoints stays bright while
    // everything else dims via CSS — see `--active` modifiers.
    const relatedLaidOutLinks = useMemo<LaidOutLink[]>(() => {
        if (!hover || hover.kind !== "link" || !relatedLinks || !layout)
            return []
        const relatedData = relatedLinks(toLinkData(hover.link))
        if (relatedData.length === 0) return []
        // Match returned plain-link descriptors back to the laid-out link
        // refs so the per-path component receives an identity-equal lookup.
        const relatedKeys = new Set(
            relatedData.map((l) => makeLinkKey(l.source, l.target))
        )
        return layout.links.filter((l) =>
            relatedKeys.has(makeLinkKey(nodeId(l.source), nodeId(l.target)))
        )
    }, [hover, relatedLinks, layout])

    const activeLinkSet = useMemo(() => {
        const set = new Set<LaidOutLink>()
        if (hover?.kind === "link") {
            set.add(hover.link)
            for (const l of relatedLaidOutLinks) set.add(l)
        } else if (hover?.kind === "node") {
            // Node hover lights up every link touching this node — d3-sankey
            // populates `sourceLinks` / `targetLinks` on the laid-out node.
            for (const l of hover.node.sourceLinks ?? []) set.add(l)
            for (const l of hover.node.targetLinks ?? []) set.add(l)
        }
        return set
    }, [hover, relatedLaidOutLinks])

    const activeNodeIds = useMemo(() => {
        if (!hover) return new Set<string>()
        const ids = new Set<string>()
        for (const link of activeLinkSet) {
            ids.add(nodeId(link.source))
            ids.add(nodeId(link.target))
        }
        if (hover.kind === "node") ids.add(hover.node.id)
        return ids
    }, [hover, activeLinkSet])

    // Active links render last so they paint on top of unfocused ribbons
    // — without this, when a node fans out to many partners, some dimmed
    // ribbons sit visually above the focused ones and read as clutter.
    const orderedLinks = useMemo<LaidOutLink[]>(() => {
        if (!layout) return []
        if (activeLinkSet.size === 0) return layout.links
        const inactive: LaidOutLink[] = []
        const active: LaidOutLink[] = []
        for (const l of layout.links) {
            if (activeLinkSet.has(l)) active.push(l)
            else inactive.push(l)
        }
        return [...inactive, ...active]
    }, [layout, activeLinkSet])

    const hoveredNodeId = hover?.kind === "node" ? hover.node.id : undefined
    const hoveredLink = hover?.kind === "link" ? hover.link : undefined

    if (!layout) return null

    const interactive = !!(
        renderLinkTooltip ||
        renderNodeTooltip ||
        onNodeClick
    )
    // Show pointer cursor only when the cursor is over a clickable node.
    // Relies on the hover state already tracking node-under-cursor (which
    // assumes clickable nodes are also hoverable — true for our consumers).
    const isOverClickableNode =
        !!onNodeClick &&
        hover?.kind === "node" &&
        (!isNodeClickable || isNodeClickable(toNodeData(hover.node)))
    const svg = (
        <svg
            ref={svgRef}
            className="sankey"
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            onMouseMove={interactive ? onSvgMouseMove : undefined}
            onMouseLeave={interactive ? onSvgMouseLeave : undefined}
            onClick={onNodeClick ? onSvgClick : undefined}
            style={isOverClickableNode ? { cursor: "pointer" } : undefined}
        >
            <g className="sankey__links">
                {orderedLinks.map((link) => (
                    <SankeyLink
                        key={makeLinkKey(
                            nodeId(link.source),
                            nodeId(link.target)
                        )}
                        link={link}
                        linkPath={linkPath}
                        linkColor={linkColor}
                        isHovered={hoveredLink === link}
                        isActive={activeLinkSet.has(link)}
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
                    />
                ))}
            </g>
        </svg>
    )

    if (!interactive) return svg

    // Bounds reported to the tooltip are the wrapper div's measured
    // dimensions, not the SVG's own width/height. The wrapper stretches to
    // fill its grid cell (see .sankey-container in Sankey.scss), so it
    // mirrors the cell. The inner SVG can be shorter than the cell —
    // SplitFlowSankey shrinks one half's SVG to equalize ky across halves —
    // and using its dimensions would let the TooltipCard's `maxHeight =
    // containerHeight - top` collapse near the bottom edge and clip
    // subtitle/body content. Falling back to the SVG props is just a
    // first-frame placeholder before clientWidth/Height are available.
    const containerEl = containerRef.current
    const tooltipBounds = containerEl
        ? {
              width: containerEl.clientWidth,
              height: containerEl.clientHeight,
          }
        : { width, height }

    const descriptor: SankeyTooltipDescriptor | null = (() => {
        if (hover?.kind === "link") {
            return renderLinkTooltip?.({ link: toLinkData(hover.link) }) ?? null
        }
        if (hover?.kind === "node") {
            return (
                renderNodeTooltip?.({
                    node: toNodeData(hover.node),
                    incomingLinks: (hover.node.targetLinks ?? []).map(
                        toLinkData
                    ),
                    outgoingLinks: (hover.node.sourceLinks ?? []).map(
                        toLinkData
                    ),
                }) ?? null
            )
        }
        return null
    })()

    // position: relative on the wrapper so the tooltip's absolute positioning
    // resolves against the chart, not some distant ancestor.
    return (
        <div ref={containerRef} className="sankey-container">
            {svg}
            {hover && descriptor && (
                <TooltipCard
                    id="sankey-tooltip"
                    x={hover.position.x}
                    y={hover.position.y}
                    offsetX={8}
                    offsetY={8}
                    style={{ maxWidth: "340px" }}
                    title={descriptor.title}
                    subtitle={descriptor.subtitle}
                    anchor={isPinned ? GrapherTooltipAnchor.Bottom : undefined}
                    containerBounds={isPinned ? undefined : tooltipBounds}
                >
                    {descriptor.content}
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

    const className = [
        "sankey__link",
        isHovered ? "sankey__link--hovered" : "",
        isActive ? "sankey__link--active" : "",
    ]
        .filter(Boolean)
        .join(" ")

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
}: {
    node: LaidOutNode
    bandWidth: number
    nodeColor?: (node: SankeyNode) => string
    isHovered?: boolean
    isActive?: boolean
}): React.ReactElement {
    const x0 = node.x0 ?? 0
    const x1 = node.x1 ?? 0
    const y0 = node.y0 ?? 0
    const y1 = node.y1 ?? 0
    const h = Math.max(0, y1 - y0)

    const isLeftSide = isNodeOnLeftSide(node)
    const x = isLeftSide ? x0 : x1 - bandWidth

    const fill = nodeColor?.(node) ?? GRAPHER_DENIM

    const className = [
        "sankey__node",
        isHovered ? "sankey__node--hovered" : "",
        isActive ? "sankey__node--active" : "",
        node.className ?? "",
    ]
        .filter(Boolean)
        .join(" ")

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
}: {
    label: PreparedSankeyLabel
    isHovered?: boolean
    isActive?: boolean
}): React.ReactElement {
    const className = [
        "sankey__label",
        isHovered ? "sankey__label--hovered" : "",
        isActive ? "sankey__label--active" : "",
        label.nodeClassName ?? "",
    ]
        .filter(Boolean)
        .join(" ")

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

function prepareSankeyLabels({
    layout,
    nodePadding,
    fontSettings,
}: {
    layout: LaidOutGraph | null
    nodePadding: number
    fontSettings: FontSettings
}): PreparedSankeyLabel[] {
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
                    nodeClassName: node.className,
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
                    nodeClassName: node.className,
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

function nodeId(
    endpoint: LaidOutLink["source"] | LaidOutLink["target"]
): string {
    if (typeof endpoint === "string" || typeof endpoint === "number")
        return String(endpoint)
    return (endpoint as SankeyLayoutNode).id
}

function toLinkData(link: LaidOutLink): SankeyLink {
    const l = link as SankeyLink & LaidOutLink
    return {
        source: nodeId(link.source),
        target: nodeId(link.target),
        value: l.value,
    }
}

// Strip d3-sankey's layout-augmented fields back to the plain SankeyNode
// shape the consumer originally passed in (id, label, optional valueLabel
// and className). Used when exposing a hovered node to renderNodeTooltip.
function toNodeData(node: LaidOutNode): SankeyNode {
    return {
        id: node.id,
        label: node.label,
        valueLabel: node.valueLabel,
        className: node.className,
    }
}

// Stable string key for (source, target) link identity. Used to match
// caller-returned SankeyLink descriptors back to the laid-out link refs
// in `activeLinkSet`. `→` is a separator that won't appear in entity IDs.
function makeLinkKey(source: string, target: string): string {
    return `${source}→${target}`
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

// Extra vertical pixels past a link's band edge that still count as a hit.
// Keeps the hover continuous across the slivers of empty pixels between
// adjacent ribbons — without this, the cursor briefly lands in *no* band,
// the tooltip flickers off, then re-attaches to the neighbour. SlopeChart
// solves the same continuity problem on zero-width lines via a 10px
// distance-to-segment tolerance (SlopeChart.tsx:683).
const LINK_BAND_GAP_TOLERANCE = 6

// Extra pixels past a node's hit shape (band box ∪ label box) that still
// count as a hit. Keeps the hover continuous across the small vertical
// gaps between stacked labels in a column — strict membership leaves
// null-hover slivers there, which makes the tooltip flicker off/on as the
// cursor crosses from one label to the next. Same idea as the link band's
// `LINK_BAND_GAP_TOLERANCE`.
const NODE_HIT_TOLERANCE = 8

/**
 * Find the hoverable node whose hit shape (band rect ∪ label rect) the
 * cursor is over, or the nearest such shape within tolerance. Returns
 * null when no node is within range. We measure to the *union* of the
 * band and label rects per node, then pick the smallest distance — so
 * the cursor doesn't have to leave the band's column to land on a label,
 * and a small gap between two stacked labels still resolves to the
 * nearer one.
 */
function findNodeAtPoint(
    nodes: LaidOutNode[],
    labels: PreparedSankeyLabel[],
    mouseX: number,
    mouseY: number,
    isHoverable?: (node: SankeyNode) => boolean
): LaidOutNode | null {
    // Index labels so we can look up label bounds per node id.
    const labelByNodeId = new Map<string, PreparedSankeyLabel>()
    for (const l of labels) labelByNodeId.set(l.nodeId, l)

    let best: { node: LaidOutNode; dist: number } | null = null
    for (const node of nodes) {
        if (isHoverable && !isHoverable(node)) continue
        const x0 = node.x0 ?? 0
        const x1 = node.x1 ?? 0
        const y0 = node.y0 ?? 0
        const y1 = node.y1 ?? 0
        let dist = rectDistance(mouseX, mouseY, x0, x1, y0, y1)

        const lbl = labelByNodeId.get(node.id)
        if (lbl) {
            const w = Math.max(lbl.label.width, lbl.valueLabel?.width ?? 0)
            const h =
                lbl.label.height +
                (lbl.valueLabel ? VALUE_LABEL_GAP + lbl.valueLabel.height : 0)
            const lx0 = lbl.textAnchor === "end" ? lbl.x - w : lbl.x
            const lx1 = lbl.textAnchor === "end" ? lbl.x : lbl.x + w
            const ly0 = lbl.y - h / 2
            const ly1 = lbl.y + h / 2
            dist = Math.min(
                dist,
                rectDistance(mouseX, mouseY, lx0, lx1, ly0, ly1)
            )
        }

        if (dist > NODE_HIT_TOLERANCE) continue
        if (!best || dist < best.dist) best = { node, dist }
    }
    return best?.node ?? null
}

// Euclidean distance from a point to the nearest edge of an axis-aligned
// rect. Returns 0 when the point is inside.
function rectDistance(
    px: number,
    py: number,
    x0: number,
    x1: number,
    y0: number,
    y1: number
): number {
    const dx = Math.max(0, x0 - px, px - x1)
    const dy = Math.max(0, y0 - py, py - y1)
    return Math.sqrt(dx * dx + dy * dy)
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
 *
 * Cheap per-mousemove: O(links), and `linkCenterY` is a 12-iteration
 * bisection on a cubic Bezier.
 */
function findLinkAtPoint(
    links: LaidOutLink[],
    mouseX: number,
    mouseY: number
): LaidOutLink | null {
    let best: { link: LaidOutLink; gap: number; dy: number } | null = null
    for (const link of links) {
        const centerY = linkCenterY(link, mouseX)
        if (centerY === null) continue
        const dy = Math.abs(mouseY - centerY)
        const halfBand = (link.width ?? 0) / 2
        const gap = Math.max(0, dy - halfBand)
        if (gap > LINK_BAND_GAP_TOLERANCE) continue
        if (!best || gap < best.gap || (gap === best.gap && dy < best.dy)) {
            best = { link, gap, dy }
        }
    }
    return best?.link ?? null
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
function linkCenterY(link: LaidOutLink, mouseX: number): number | null {
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
