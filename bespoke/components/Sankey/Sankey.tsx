import { useMemo } from "react"
import {
    sankey as d3Sankey,
    sankeyLinkHorizontal,
    SankeyGraph,
    SankeyNode as D3SankeyNode,
    SankeyLink as D3SankeyLink,
} from "d3-sankey"
import { TextWrap } from "@ourworldindata/components"

export type SankeyNode = {
    id: string
    /** A single string renders as one line; an array renders as multiple lines centered around the node midpoint. */
    label?: string | string[]
}

export type SankeyLink = {
    source: string
    target: string
    value: number
}

type Margin = { top: number; right: number; bottom: number; left: number }

const DEFAULT_MARGIN: Margin = { top: 8, right: 8, bottom: 8, left: 8 }

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
// Vertical strip reserved above the chart for column header labels, when any
// are provided.
const COLUMN_LABEL_HEIGHT_PX = 20

export function measureMaxLabelWidth(label: SankeyNode["label"]): number {
    const lines = (Array.isArray(label) ? label : label ? [label] : []).filter(
        Boolean
    )
    if (lines.length === 0) return 0
    return Math.max(
        ...lines.map(
            (text) =>
                new TextWrap({
                    text,
                    fontSize: LABEL_FONT_SIZE_PX,
                    maxWidth: Infinity,
                }).width
        )
    )
}

export type SankeyProps = {
    nodes: SankeyNode[]
    links: SankeyLink[]
    width: number
    height: number
    nodeColor?: (node: SankeyNode) => string
    linkColor?: (link: SankeyLink) => string
    /** Used in `<title>` (native browser tooltip) attached to each link. */
    formatValue?: (value: number) => string
    nodeWidth?: number
    nodePadding?: number
    margin?: Margin
    /**
     * Optional header per column, indexed by node depth. `undefined` entries
     * skip rendering. When any entry is set, vertical space is reserved at
     * the top of the chart for the labels.
     */
    columnLabels?: (string | undefined)[]
    /**
     * Number of relaxation iterations d3-sankey performs to minimize link
     * crossings. Defaults to d3-sankey's default (6). Pass 0 to skip
     * relaxation and use the initial top-down stacking — useful when you
     * want single-node columns pinned to the top of their column.
     */
    iterations?: number
    /**
     * Node ID to pin to the top of its column. d3-sankey otherwise
     * redistributes leftover vertical space evenly around nodes within a
     * column, which visually centers single-node columns. Pinning shifts
     * the node (and its connected link endpoints) so that its `y0` sits at
     * the top of the layout extent.
     */
    pinNodeIdToTop?: string
    /**
     * Render each node as a narrow band anchored to its outer edge (the
     * one away from the chart's center), with `gapWidth` of whitespace
     * between the band and the flow path. The effective node width
     * becomes `bandWidth + gapWidth`, overriding `nodeWidth`.
     * Designed for 2-column Sankeys — for middle-column nodes the band
     * picks a side from the node's midpoint, which may not be intended.
     */
    nodeOuterBand?: { bandWidth: number; gapWidth: number }
    /**
     * Floor for the auto-computed left/right label margin. Use this to
     * coordinate label-area widths across multiple Sankeys rendered side
     * by side, so their inner flow regions end up the same width.
     */
    minLeftMargin?: number
    minRightMargin?: number
}

type LaidOutGraph = SankeyGraph<SankeyNode, SankeyLink>
type LaidOutNode = D3SankeyNode<SankeyNode, SankeyLink>
type LaidOutLink = D3SankeyLink<SankeyNode, SankeyLink>

export function Sankey({
    nodes,
    links,
    width,
    height,
    nodeColor,
    linkColor,
    formatValue,
    nodeWidth = 15,
    nodePadding = 8,
    margin = DEFAULT_MARGIN,
    columnLabels,
    iterations,
    pinNodeIdToTop,
    nodeOuterBand,
    minLeftMargin,
    minRightMargin,
}: SankeyProps): React.ReactElement | null {
    const hasColumnLabels = columnLabels?.some(Boolean) ?? false
    const columnLabelReservation = hasColumnLabels ? COLUMN_LABEL_HEIGHT_PX : 0
    // When rendering nodes as outer bands, the effective node width is
    // band + gap — overrides any passed `nodeWidth`.
    const effectiveNodeWidth = nodeOuterBand
        ? nodeOuterBand.bandWidth + nodeOuterBand.gapWidth
        : nodeWidth

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
                .map((n) => measureMaxLabelWidth(n.label))
        )
        const rightLabelWidth = Math.max(
            0,
            ...nodes
                .filter((n) => !hasOutgoing.has(n.id))
                .map((n) => measureMaxLabelWidth(n.label))
        )

        const finalMargin = {
            top: margin.top + columnLabelReservation,
            bottom: margin.bottom,
            left: Math.max(
                margin.left +
                    (leftLabelWidth > 0 ? leftLabelWidth + LABEL_OFFSET : 0),
                minLeftMargin ?? 0
            ),
            right: Math.max(
                margin.right +
                    (rightLabelWidth > 0 ? rightLabelWidth + LABEL_OFFSET : 0),
                minRightMargin ?? 0
            ),
        }

        const generator = d3Sankey<SankeyNode, SankeyLink>()
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
        if (iterations !== undefined) generator.iterations(iterations)

        const result = generator({
            nodes: nodes.map((d) => ({ ...d })),
            links: links.map((d) => ({ ...d })),
        })

        // Pin a node to the top of its column by shifting it (and the link
        // endpoints that touch it) up by however much d3-sankey's initial
        // "redistribute leftover space" pass pushed it down. Without this,
        // single-node columns always render visually centered.
        if (pinNodeIdToTop) {
            const node = result.nodes.find((n) => n.id === pinNodeIdToTop)
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
        columnLabelReservation,
        iterations,
        pinNodeIdToTop,
        minLeftMargin,
        minRightMargin,
    ])

    if (!layout) return null

    const linkPath = sankeyLinkHorizontal<SankeyNode, SankeyLink>()
    const midX = width / 2
    const columnLabelY = margin.top + COLUMN_LABEL_HEIGHT_PX / 2
    // For 2-column Sankeys with BOTH columns labelled, flow-midpoint
    // placement puts the labels at the same x — they'd overlap. In that
    // case fall back to placing each label over its own column. When only
    // one column is labelled, flow-midpoint works fine.
    const distinctDepths = new Set(layout.nodes.map((n) => n.depth ?? 0))
    const nonEmptyLabelCount = columnLabels?.filter(Boolean).length ?? 0
    const useColumnCenter = distinctDepths.size <= 2 && nonEmptyLabelCount >= 2

    return (
        <svg
            className="sankey"
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
        >
            {hasColumnLabels && (
                <g className="sankey__column-labels">
                    {columnLabels?.map((label, depth) => {
                        if (!label) return null
                        const nodeAtDepth = layout.nodes.find(
                            (n) => n.depth === depth
                        )
                        if (!nodeAtDepth) return null
                        // Position the label at the horizontal midpoint of
                        // the flow connecting this column to its neighbour:
                        // prefer the outgoing flow (to depth+1); fall back
                        // to the incoming flow (from depth-1) for the
                        // rightmost column. As a last resort (isolated
                        // column), center on the node itself.
                        const nextNode = layout.nodes.find(
                            (n) => n.depth === depth + 1
                        )
                        const prevNode = layout.nodes.find(
                            (n) => n.depth === depth - 1
                        )
                        const cx = useColumnCenter
                            ? ((nodeAtDepth.x0 ?? 0) + (nodeAtDepth.x1 ?? 0)) /
                              2
                            : nextNode
                              ? ((nodeAtDepth.x1 ?? 0) + (nextNode.x0 ?? 0)) / 2
                              : prevNode
                                ? ((prevNode.x1 ?? 0) + (nodeAtDepth.x0 ?? 0)) /
                                  2
                                : ((nodeAtDepth.x0 ?? 0) +
                                      (nodeAtDepth.x1 ?? 0)) /
                                  2
                        return (
                            <text
                                key={depth}
                                className="sankey__column-label"
                                x={cx}
                                y={columnLabelY}
                                textAnchor="middle"
                                dominantBaseline="central"
                            >
                                {label}
                            </text>
                        )
                    })}
                </g>
            )}
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
                        >
                            {formatValue && (
                                <title>
                                    {nodeId(link.source)} →{" "}
                                    {nodeId(link.target)}:{" "}
                                    {formatValue(link.value ?? 0)}
                                </title>
                            )}
                        </path>
                    )
                })}
            </g>
            <g className="sankey__nodes">
                {layout.nodes.map((node) => {
                    const fill = nodeColor?.(nodeOriginal(node)) ?? "#444"
                    const x0 = node.x0 ?? 0
                    const x1 = node.x1 ?? 0
                    const y0 = node.y0 ?? 0
                    const y1 = node.y1 ?? 0
                    const h = Math.max(0, y1 - y0)
                    if (nodeOuterBand) {
                        // Render a single band anchored to the node's outer
                        // edge (away from the chart's center); the rest of
                        // [x0, x1] is whitespace separating the band from
                        // the flow path that emerges at x1 / x0.
                        const isLeftSide = (x0 + x1) / 2 < midX
                        const bandX = isLeftSide
                            ? x0
                            : x1 - nodeOuterBand.bandWidth
                        return (
                            <rect
                                key={node.id}
                                className="sankey__node"
                                x={bandX}
                                y={y0}
                                width={nodeOuterBand.bandWidth}
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
                    const n = node as SankeyNode & LaidOutNode
                    const raw = n.label ?? n.id
                    const lines = (Array.isArray(raw) ? raw : [raw]).filter(
                        Boolean
                    )
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
    return (endpoint as SankeyNode).id
}

function nodeOriginal(node: LaidOutNode): SankeyNode {
    const n = node as SankeyNode & LaidOutNode
    return { id: n.id, label: n.label }
}

function linkOriginal(link: LaidOutLink): SankeyLink {
    const l = link as SankeyLink & LaidOutLink
    return {
        source: nodeId(link.source),
        target: nodeId(link.target),
        value: l.value,
    }
}
