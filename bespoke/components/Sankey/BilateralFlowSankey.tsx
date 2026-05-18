import { useMemo } from "react"

import { Sankey, SankeyLink, SankeyNode } from "./Sankey.js"
import {
    assignColors,
    DEFAULT_MIN_LINK_SHARE,
    DEFAULT_MIN_NODE_SHARE,
    DEFAULT_TOP_N,
    entityFromId,
    EntityTotal,
    FlowRow,
    makeSourceId,
    makeTargetId,
    makeValueLabel,
    NEUTRAL_COLOR,
    OTHER_KEY,
    selectTopEntities,
} from "./helpers.js"

export function BilateralFlowSankey({
    rows,
    width,
    height,
    formatValue,
    topN = DEFAULT_TOP_N,
    minNodeShare = DEFAULT_MIN_NODE_SHARE,
    minLinkShare = DEFAULT_MIN_LINK_SHARE,
}: {
    rows: FlowRow[]
    width: number
    height: number
    /** Format a raw value for display in node value labels */
    formatValue: (value: number) => string
    /** Number of top sources/targets shown individually before bucketing into "Other" */
    topN?: number
    /** Minimum share of its column total an entity must reach to keep its own
     * node slot; below this it's folded into the "Other" bucket. */
    minNodeShare?: number
    /** Minimum share of total visible flow a top-to-top link must reach to be
     * drawn. Other-bucket links are exempt and always render when non-zero. */
    minLinkShare?: number
}) {
    const { nodes, links } = useMemo(
        () =>
            buildBilateral({
                rows,
                topN,
                minNodeShare,
                minLinkShare,
                formatValue,
            }),
        [rows, topN, minNodeShare, minLinkShare, formatValue]
    )

    // Only sources carry color in this view. Source nodes are already in
    // descending-total order coming out of buildBilateral, so assigning colors
    // in node order = assigning by rank
    const colorMap = useMemo(() => {
        const sourceEntities = nodes
            .filter((n) => n.id.startsWith("source:"))
            .map((n) => entityFromId(n.id))
        return assignColors(sourceEntities)
    }, [nodes])

    const nodeColor = (node: SankeyNode): string => {
        if (node.id.startsWith("target:")) return NEUTRAL_COLOR
        const source = entityFromId(node.id)
        return colorMap.get(source) ?? NEUTRAL_COLOR
    }

    const linkColor = (link: SankeyLink): string => {
        // Flows inherit the source's color.
        const source = entityFromId(link.source)
        return colorMap.get(source) ?? NEUTRAL_COLOR
    }

    return (
        <Sankey
            nodes={nodes}
            links={links}
            width={width}
            height={height}
            nodeColor={nodeColor}
            linkColor={linkColor}
        />
    )
}

function buildBilateral({
    rows,
    topN,
    minNodeShare,
    minLinkShare,
    formatValue,
}: {
    rows: FlowRow[]
    topN: number
    minNodeShare: number
    minLinkShare: number
    formatValue: (value: number) => string
}): {
    nodes: SankeyNode[]
    links: SankeyLink[]
} {
    const sourceSelection = selectTopEntities({
        rows,
        side: "source",
        topN: topN,
        minNodeShare,
    })
    const targetSelection = selectTopEntities({
        rows,
        side: "target",
        topN: topN,
        minNodeShare,
    })

    const total = Math.max(
        sourceSelection.grandTotal,
        targetSelection.grandTotal
    )
    if (total === 0) return { nodes: [], links: [] }

    const topSources = new Set(sourceSelection.top.map((d) => d.entity))
    const topTargets = new Set(targetSelection.top.map((d) => d.entity))

    // Aggregate row values into (source, target) pairs.
    // Non-top entities collapse into the Other buckets per side.
    const pairsByKey = new Map<string, FlowRow>()
    for (const row of rows) {
        const source = topSources.has(row.source) ? row.source : OTHER_KEY
        const target = topTargets.has(row.target) ? row.target : OTHER_KEY

        const key = `${source} -> ${target}`
        const existing = pairsByKey.get(key)

        if (existing) {
            existing.value += row.value
        } else {
            pairsByKey.set(key, { source, target, value: row.value })
        }
    }

    // Drop links below the floor
    const positivePairs = Array.from(pairsByKey.values()).filter(
        (p) => p.value > 0
    )
    const filteredPairs = positivePairs.filter((p) => {
        const involvesOther = p.source === OTHER_KEY || p.target === OTHER_KEY
        if (involvesOther) return true
        return p.value / total >= minLinkShare
    })
    const visiblePairs =
        filteredPairs.length > 0 ? filteredPairs : positivePairs

    const nodes: SankeyNode[] = [
        ...buildColumnNodes({
            selection: sourceSelection,
            visiblePairs,
            side: "source",
            makeNodeId: makeSourceId,
            formatValue,
        }),
        ...buildColumnNodes({
            selection: targetSelection,
            visiblePairs,
            side: "target",
            makeNodeId: makeTargetId,
            formatValue,
        }),
    ]

    const links: SankeyLink[] = visiblePairs.map((p) => ({
        source: makeSourceId(p.source),
        target: makeTargetId(p.target),
        value: p.value,
    }))

    return { nodes, links }
}

function buildColumnNodes({
    selection,
    visiblePairs,
    side,
    makeNodeId,
    formatValue,
}: {
    selection: { top: EntityTotal[]; grandTotal: number }
    visiblePairs: FlowRow[]
    side: "source" | "target"
    makeNodeId: (entity: string) => string
    formatValue: (v: number) => string
}): SankeyNode[] {
    const activeEntities = new Set(visiblePairs.map((p) => p[side]))
    const topNodes = selection.top
        .filter((d) => activeEntities.has(d.entity))
        .map((d) => ({
            id: makeNodeId(d.entity),
            label: d.entity,
            valueLabel: makeValueLabel({
                value: d.total,
                total: selection.grandTotal,
                formatValue,
            }),
        }))

    const otherNode: SankeyNode[] = activeEntities.has(OTHER_KEY)
        ? [{ id: makeNodeId(OTHER_KEY), label: "Other" }]
        : []

    return [...topNodes, ...otherNode]
}
