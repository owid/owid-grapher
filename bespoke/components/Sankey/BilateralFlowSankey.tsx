import { useMemo } from "react"

import {
    LinkTooltipArgs,
    NodeTooltipArgs,
    Sankey,
    SankeyLink,
    SankeyNode,
    SankeyTooltip,
} from "./Sankey.js"
import {
    assignColors,
    DEFAULT_MIN_LINK_SHARE,
    DEFAULT_MIN_NODE_SHARE,
    DEFAULT_TOP_N,
    entityFromId,
    entityShortLabel,
    EntityTotal,
    FlowRow,
    makeSourceId,
    makeTargetId,
    makeValueLabel,
    NEUTRAL_COLOR,
    OTHER_KEY,
    selectTopEntities,
} from "./helpers.js"

export type BilateralTooltipArgs = {
    /** Which side of the chart the user is hovering over. Determines what
     *  `partners` and `tradeRows` represent. */
    side: "exporter" | "importer"
    /** Display name of the hovered country. "Other" for the bucket. */
    country: string
    /** Per-partner aggregate, sorted desc by value. For `side="exporter"`
     *  the partners are importers receiving from this country; for
     *  `side="importer"` they're exporters sending to this country.
     *  When `country === "Other"` the aggregate pools heterogeneous flows
     *  and `tradeRows` is usually the more informative view. */
    partners: { entity: string; value: number }[]
    /** Underlying raw flow rows belonging to this ribbon/node, sorted desc
     *  by value. For a named country one of source/target is constant
     *  across rows; for the Other bucket each row is a distinct trade
     *  pair, which is typically what the consumer wants to render. */
    tradeRows: FlowRow[]
}

export function BilateralFlowSankey({
    rows,
    width,
    height,
    formatValue,
    topN = DEFAULT_TOP_N,
    minNodeShare = DEFAULT_MIN_NODE_SHARE,
    minLinkShare = DEFAULT_MIN_LINK_SHARE,
    renderTooltip,
    onSelectEntity,
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
    /** Per-exporter tooltip renderer. Hovering any link promotes to its
     *  exporter (source) group: all of that exporter's links highlight as
     *  one unit, and the consumer is handed the source name + the list of
     *  importers it sent to. */
    renderTooltip?: (args: BilateralTooltipArgs) => SankeyTooltip | undefined
    /** When set, clicking a column label (or its band) fires this with the
     *  entity name and the side it's on. The Other bucket is non-clickable
     *  because it isn't a single entity. */
    onSelectEntity?: (entity: string, side: "exporter" | "importer") => void
}) {
    const { nodes, links, topSources, topTargets } = useMemo(
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

    // All other links sharing the hovered link's source — Sankey adds the
    // hovered link itself to the highlight set separately, so this returns
    // only its siblings. Match by target rather than identity because
    // Sankey reconstructs the hovered link as a plain object via
    // `toLinkData` before passing it back here.
    const relatedLinksByLink = (link: SankeyLink): SankeyLink[] =>
        links.filter(
            (l) => l.source === link.source && l.target !== link.target
        )

    // Look up the chart-aggregated set of small entities on the side
    // opposite to `side`. Used to recognize the "Other" ribbon/node when
    // the consumer hovers the right column. Computed once from the
    // memoized build above (`topSources`); a target-side equivalent is
    // captured below.
    const getLinkTooltip = renderTooltip
        ? ({ link }: LinkTooltipArgs): SankeyTooltip | undefined => {
              // Link hover resolves to the exporter side: the source-side
              // ribbon shares the hovered link's source entity (see
              // `relatedLinksByLink` above). Node hover handles the
              // importer-side view separately.
              const sourceKey = entityFromId(link.source)
              const args = buildTooltipArgs({
                  side: "exporter",
                  entityKey: sourceKey,
                  rows,
                  topSources,
                  topTargets,
              })
              return renderTooltip(args)
          }
        : undefined

    const getNodeTooltip = renderTooltip
        ? ({ node }: NodeTooltipArgs): SankeyTooltip | undefined => {
              const isTarget = node.id.startsWith("target:")
              const side = isTarget ? "importer" : "exporter"
              const entityKey = entityFromId(node.id)
              const args = buildTooltipArgs({
                  side,
                  entityKey,
                  rows,
                  topSources,
                  topTargets,
              })
              return renderTooltip(args)
          }
        : undefined

    const handleNodeClick = onSelectEntity
        ? (node: SankeyNode) => {
              const side: "exporter" | "importer" = node.id.startsWith(
                  "target:"
              )
                  ? "importer"
                  : "exporter"
              onSelectEntity(entityFromId(node.id), side)
          }
        : undefined

    // Other isn't a single entity, so it can't be drilled into.
    const isNodeClickable = (node: SankeyNode): boolean =>
        entityFromId(node.id) !== OTHER_KEY

    return (
        <Sankey
            nodes={nodes}
            links={links}
            width={width}
            height={height}
            nodeColor={nodeColor}
            linkColor={linkColor}
            getLinkTooltip={getLinkTooltip}
            getRelatedLinks={renderTooltip ? relatedLinksByLink : undefined}
            getNodeTooltip={getNodeTooltip}
            onNodeClick={handleNodeClick}
            isNodeClickable={onSelectEntity ? isNodeClickable : undefined}
        />
    )
}

// Shared between the link-hover and node-hover wrappers. Filters the raw
// rows to those belonging to the hovered ribbon/node, aggregates by the
// opposite endpoint to produce `partners`, and packages everything in the
// shape the consumer's renderTooltip expects.
function buildTooltipArgs({
    side,
    entityKey,
    rows,
    topSources,
    topTargets,
}: {
    side: "exporter" | "importer"
    entityKey: string
    rows: FlowRow[]
    topSources: Set<string>
    topTargets: Set<string>
}): BilateralTooltipArgs {
    const isOther = entityKey === OTHER_KEY
    const country = isOther ? "Other" : entityKey

    // For an exporter hover the matching rows are those whose source is
    // this country (or, for Other, any source outside the visible top-N).
    // Importer hover is the mirror image on the target side.
    const matchingRows =
        side === "exporter"
            ? rows.filter((r) =>
                  isOther ? !topSources.has(r.source) : r.source === entityKey
              )
            : rows.filter((r) =>
                  isOther ? !topTargets.has(r.target) : r.target === entityKey
              )

    const partnerKey: "source" | "target" =
        side === "exporter" ? "target" : "source"
    const totalByPartner = new Map<string, number>()
    for (const r of matchingRows) {
        const key = r[partnerKey]
        totalByPartner.set(key, (totalByPartner.get(key) ?? 0) + r.value)
    }
    const partners = Array.from(totalByPartner.entries())
        .map(([entity, value]) => ({ entity, value }))
        .sort((a, b) => b.value - a.value)

    const tradeRows = [...matchingRows].sort((a, b) => b.value - a.value)

    return {
        side,
        country,
        partners,
        tradeRows,
    }
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
    /** Entity keys NOT folded into the source-side Other bucket. Surfaced
     *  so the tooltip can resolve which raw rows belong to the Other-source
     *  ribbon (everything outside this set). */
    topSources: Set<string>
    /** Entity keys NOT folded into the target-side Other bucket. Same role
     *  as `topSources`, for the importer (right) column. */
    topTargets: Set<string>
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
    const topSources = new Set(sourceSelection.top.map((d) => d.entity))
    const topTargets = new Set(targetSelection.top.map((d) => d.entity))
    if (total === 0) return { nodes: [], links: [], topSources, topTargets }

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

    return { nodes, links, topSources, topTargets }
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
            // ID keeps the full entity name (used for color/tooltip lookups);
            // the on-chart label uses the shorter form for readability.
            id: makeNodeId(d.entity),
            label: entityShortLabel(d.entity),
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
