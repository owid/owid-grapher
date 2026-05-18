import React, { useMemo } from "react"
import {
    sankey as d3Sankey,
    sankeyLinkHorizontal,
    SankeyGraph,
    SankeyNode as D3SankeyNode,
    SankeyLink as D3SankeyLink,
} from "d3-sankey"
import { Bounds, VerticalAlign } from "@ourworldindata/utils"
import {
    GRAPHER_DARK_TEXT,
    GRAPHER_DENIM,
    GRAPHER_LIGHT_TEXT,
    type FontSettings,
} from "@ourworldindata/grapher"
import { TextWrap, TextWrapSvg } from "@ourworldindata/components"

/* Horizontal gap between a node's edge and its label */
export const BAND_LABEL_GAP = 6

/** Vertical gap between a node's value label and its label */
const VALUE_LABEL_GAP = 2

export const DEFAULT_SANKEY_FONT_SETTINGS: FontSettings = {
    fontSize: 12,
    fontWeight: 400,
    lineHeight: 1,
}

const DEFAULT_MARGIN: Margin = { top: 0, right: 0, bottom: 0, left: 0 }

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

type PreparedSankeyLabel = {
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
    fontSettings = DEFAULT_SANKEY_FONT_SETTINGS,
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
        const verticalLabelPadding =
            0.5 * fontSettings.fontSize * fontSettings.lineHeight

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

    if (!layout) return null

    return (
        <svg
            className="sankey"
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
        >
            <g className="sankey__links">
                {layout.links.map((link, i) => (
                    <SankeyLink
                        key={i}
                        link={link}
                        linkPath={linkPath}
                        linkColor={linkColor}
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
                    />
                ))}
            </g>
            <g className="sankey__labels">
                {labels.map((label, i) => (
                    <SankeyLabel key={i} label={label} />
                ))}
            </g>
        </svg>
    )
}

function SankeyLink({
    link,
    linkPath,
    linkColor,
}: {
    link: LaidOutLink
    linkPath: (link: LaidOutLink) => string | null
    linkColor?: (link: SankeyLink) => string
}): React.ReactElement | null {
    const path = linkPath(link)
    if (!path) return null

    const color = linkColor?.(toLinkData(link)) ?? GRAPHER_DENIM
    const width = Math.max(0.5, link.width ?? 0)

    return (
        <path
            className="sankey__link"
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
}: {
    node: LaidOutNode
    bandWidth: number
    nodeColor?: (node: SankeyNode) => string
}): React.ReactElement {
    const x0 = node.x0 ?? 0
    const x1 = node.x1 ?? 0
    const y0 = node.y0 ?? 0
    const y1 = node.y1 ?? 0
    const h = Math.max(0, y1 - y0)

    const isLeftSide = isNodeOnLeftSide(node)
    const x = isLeftSide ? x0 : x1 - bandWidth

    const fill = nodeColor?.(node) ?? GRAPHER_DENIM

    return (
        <rect
            className="sankey__node"
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
}: {
    label: PreparedSankeyLabel
}): React.ReactElement {
    if (label.valueLabel) {
        const labelY =
            label.y - 0.5 * label.label.height - 0.5 * VALUE_LABEL_GAP
        const valueLabelY = labelY + label.label.height + VALUE_LABEL_GAP

        return (
            <>
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
            </>
        )
    }

    return (
        <TextWrapSvg
            textWrap={label.label}
            x={label.x}
            y={label.y}
            textAnchor={label.textAnchor}
            fill={GRAPHER_DARK_TEXT}
        />
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
    fontSettings: FontSettings = DEFAULT_SANKEY_FONT_SETTINGS
): number {
    return Math.max(
        textWidth(node.label, fontSettings),
        node.valueLabel ? textWidth(node.valueLabel, fontSettings) : 0
    )
}

function textWidth(text: string, fontSettings: FontSettings): number {
    return Bounds.forText(text, fontSettings).width
}
