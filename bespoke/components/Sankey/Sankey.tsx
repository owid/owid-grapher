import { useMemo } from "react"
import {
    sankey as d3Sankey,
    sankeyLinkHorizontal,
    SankeyGraph,
    SankeyNode as D3SankeyNode,
    SankeyLink as D3SankeyLink,
} from "d3-sankey"
import { TextWrap } from "@ourworldindata/components"

// Approx height of one line at the default font-size of 12px with 1.2em line-height.
const LABEL_LINE_HEIGHT_PX = 14
const LABEL_FONT_SIZE_PX = 12
// Tolerance subtracted from the strict line-height threshold when deciding
// whether a node is tall enough for multi-line labels. Larger values lower
// the bar — more nodes show their secondary lines, at the cost of slightly
// cramped labels on borderline nodes.
const LABEL_STACK_TOLERANCE_PX = 4
// Horizontal gap between a node's edge and its label.
export const LABEL_OFFSET = 6

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
}

export type SankeyNode = {
    id: string
    label: string
    value?: string
}

export type SankeyLink = {
    source: string
    target: string
    value: number
}

type Margin = { top: number; right: number; bottom: number; left: number }

type SankeyLayoutNode = Pick<SankeyNode, "id" | "label">
type LaidOutGraph = SankeyGraph<SankeyLayoutNode, SankeyLink>
type LaidOutNode = D3SankeyNode<SankeyLayoutNode, SankeyLink>
type LaidOutLink = D3SankeyLink<SankeyLayoutNode, SankeyLink>

export function Sankey({
    nodes,
    links,
    width,
    height,
    nodeColor,
    linkColor,
    margin = { top: 0, right: 0, bottom: 0, left: 0 },
    innerMargin,
    topAnchored = false,
    nodePadding = 12,
    bandWidth = 4,
    bandFlowGap = 3,
}: SankeyProps): React.ReactElement | null {
    const nodeById = useMemo(
        () => new Map(nodes.map((node) => [node.id, node] as const)),
        [nodes]
    )

    // d3-sankey treats the whole `bandWidth + bandFlowGap` strip as the
    // node width; we then render the visible band inside that strip and
    // leave `bandFlowGap` of whitespace between it and the flow path.
    const effectiveNodeWidth = bandWidth + bandFlowGap

    const layout = useMemo<LaidOutGraph | null>(() => {
        if (width <= 0 || height <= 0) return null
        // d3-sankey crashes on an empty graph (it calls `new Array(NaN)`
        // when computing layer count from nodes with no depth). Bail out.
        if (nodes.length === 0) return null

        // Determine which nodes' labels render outside the chart area, by
        // graph topology: nodes with no incoming links sit in the leftmost
        // column (labels go to the left), nodes with no outgoing links sit
        // in the rightmost column (labels go to the right). Middle-column
        // nodes' labels render inside the chart and don't affect margins.
        const hasIncoming = new Set<string>()
        const hasOutgoing = new Set<string>()
        for (const link of links) {
            hasOutgoing.add(link.source)
            hasIncoming.add(link.target)
        }

        const leftLabelWidth = Math.max(
            0,
            ...nodes
                .filter((n) => !hasIncoming.has(n.id))
                .map((n) => measureNodeMaxTextWidth(n))
        )
        const rightLabelWidth = Math.max(
            0,
            ...nodes
                .filter((n) => !hasOutgoing.has(n.id))
                .map((n) => measureNodeMaxTextWidth(n))
        )

        const finalMargin = {
            top: margin.top + (innerMargin?.top ?? 0),
            bottom: margin.bottom + (innerMargin?.bottom ?? 0),
            left:
                margin.left +
                Math.max(
                    leftLabelWidth > 0 ? leftLabelWidth + LABEL_OFFSET : 0,
                    innerMargin?.left ?? 0
                ),
            right:
                margin.right +
                Math.max(
                    rightLabelWidth > 0 ? rightLabelWidth + LABEL_OFFSET : 0,
                    innerMargin?.right ?? 0
                ),
        }

        const sourceNodes = nodes.filter((n) => !hasIncoming.has(n.id))
        const sinkNodes = nodes.filter((n) => !hasOutgoing.has(n.id))
        const inferredPinNodeId =
            sourceNodes.length === 1
                ? sourceNodes[0].id
                : sinkNodes.length === 1
                  ? sinkNodes[0].id
                  : undefined

        const generator = d3Sankey<SankeyLayoutNode, SankeyLink>()
            .nodeId((d) => d.id)
            .nodeWidth(effectiveNodeWidth)
            .nodePadding(nodePadding)
            // Sort within each column by input order so the caller controls
            // vertical placement (e.g. by inserting "Other" buckets last).
            // Default behaviour minimizes link crossings, which is unhelpful
            // for one-to-many fan-out shapes.
            .nodeSort(null)
            .extent([
                [finalMargin.left, finalMargin.top],
                [width - finalMargin.right, height - finalMargin.bottom],
            ])
        if (topAnchored) generator.iterations(0)

        const result = generator({
            nodes: nodes.map(({ id, label }) => ({ id, label })),
            links: links.map((d) => ({ ...d })),
        })

        // In topAnchored mode, pin a uniquely identifiable edge-column node
        // to the top of its column by shifting it (and touching link
        // endpoints) up by however much d3-sankey pushed it down.
        if (topAnchored && inferredPinNodeId) {
            const node = result.nodes.find((n) => n.id === inferredPinNodeId)
            if (
                node &&
                node.y0 !== undefined &&
                node.y1 !== undefined &&
                node.y0 > finalMargin.top
            ) {
                const delta = node.y0 - finalMargin.top
                node.y0 -= delta
                node.y1 -= delta
                for (const link of node.targetLinks ?? []) {
                    if (link.y1 !== undefined) link.y1 -= delta
                }
                for (const link of node.sourceLinks ?? []) {
                    if (link.y0 !== undefined) link.y0 -= delta
                }
            }
        }

        return result
    }, [
        nodes,
        links,
        width,
        height,
        effectiveNodeWidth,
        nodePadding,
        margin,
        topAnchored,
        innerMargin,
    ])

    if (!layout) return null

    const linkPath = sankeyLinkHorizontal<SankeyNode, SankeyLink>()
    const midX = width / 2

    return (
        <svg
            className="sankey"
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
        >
            <g className="sankey__links">
                {layout.links.map((link, i) => {
                    const path = linkPath(link)
                    if (!path) return null
                    const color = linkColor?.(linkOriginal(link)) ?? "#888"
                    return (
                        <path
                            key={i}
                            className="sankey__link"
                            d={path}
                            stroke={color}
                            strokeWidth={Math.max(1, link.width ?? 0)}
                        />
                    )
                })}
            </g>
            <g className="sankey__nodes">
                {layout.nodes.map((node) => {
                    const fill =
                        nodeColor?.(nodeOriginal(node, nodeById)) ?? "#444"
                    const x0 = node.x0 ?? 0
                    const x1 = node.x1 ?? 0
                    const y0 = node.y0 ?? 0
                    const y1 = node.y1 ?? 0
                    const h = Math.max(0, y1 - y0)
                    if (bandWidth > 0) {
                        // Render a single band anchored to the node's outer
                        // edge (away from the chart's center); the rest of
                        // [x0, x1] is whitespace separating the band from
                        // the flow path that emerges at x1 / x0.
                        const isLeftSide = (x0 + x1) / 2 < midX
                        const bandX = isLeftSide ? x0 : x1 - bandWidth
                        return (
                            <rect
                                key={node.id}
                                className="sankey__node"
                                x={bandX}
                                y={y0}
                                width={bandWidth}
                                height={h}
                                fill={fill}
                            />
                        )
                    }
                    return (
                        <rect
                            key={node.id}
                            className="sankey__node"
                            x={x0}
                            y={y0}
                            width={x1 - x0}
                            height={h}
                            fill={fill}
                        />
                    )
                })}
            </g>
            <g className="sankey__labels">
                {layout.nodes.map((node) => {
                    const n = node as SankeyLayoutNode & LaidOutNode
                    const original = nodeById.get(n.id)
                    const lines = [
                        original?.label ?? n.label,
                        original?.value,
                    ].filter(Boolean)
                    if (lines.length === 0) return null
                    const x0 = node.x0 ?? 0
                    const x1 = node.x1 ?? 0
                    const y0 = node.y0 ?? 0
                    const y1 = node.y1 ?? 0
                    const nodeHeight = y1 - y0
                    const isLeftSide = (x0 + x1) / 2 < midX
                    const labelX = isLeftSide
                        ? x0 - LABEL_OFFSET
                        : x1 + LABEL_OFFSET
                    const labelY = (y0 + y1) / 2
                    // Stack multi-line labels only when the node is tall enough.
                    // Otherwise drop the secondary lines and keep just the
                    // primary one — clearer than crowding lines into a node.
                    const fitsStacked =
                        nodeHeight >=
                        lines.length * LABEL_LINE_HEIGHT_PX -
                            LABEL_STACK_TOLERANCE_PX
                    const visibleLines = fitsStacked ? lines : [lines[0]]
                    return (
                        <text
                            key={node.id}
                            className="sankey__label"
                            y={labelY}
                            textAnchor={isLeftSide ? "end" : "start"}
                            dominantBaseline="central"
                        >
                            {visibleLines.map((line, i) => (
                                <tspan
                                    key={i}
                                    x={labelX}
                                    dy={
                                        i === 0
                                            ? `${-(visibleLines.length - 1) * 0.6}em`
                                            : "1.2em"
                                    }
                                >
                                    {line}
                                </tspan>
                            ))}
                        </text>
                    )
                })}
            </g>
        </svg>
    )
}

function nodeId(
    endpoint: LaidOutLink["source"] | LaidOutLink["target"]
): string {
    if (typeof endpoint === "string" || typeof endpoint === "number")
        return String(endpoint)
    return (endpoint as SankeyLayoutNode).id
}

function nodeOriginal(
    node: LaidOutNode,
    nodeById: Map<string, SankeyNode>
): SankeyNode {
    const n = node as SankeyLayoutNode & LaidOutNode
    return nodeById.get(n.id) ?? { id: n.id, label: n.label }
}

function linkOriginal(link: LaidOutLink): SankeyLink {
    const l = link as SankeyLink & LaidOutLink
    return {
        source: nodeId(link.source),
        target: nodeId(link.target),
        value: l.value,
    }
}

export function measureMaxLabelWidth(label: SankeyNode["label"]): number {
    return new TextWrap({
        text: label,
        fontSize: LABEL_FONT_SIZE_PX,
        maxWidth: Infinity,
    }).width
}

export function measureNodeMaxTextWidth({
    label,
    value,
}: Pick<SankeyNode, "label" | "value">): number {
    return Math.max(
        measureMaxLabelWidth(label),
        value ? measureMaxLabelWidth(value) : 0
    )
}
