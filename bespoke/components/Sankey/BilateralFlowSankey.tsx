import { useMemo } from "react"
import * as R from "remeda"
import { match } from "ts-pattern"

import {
    LinkSide,
    LinkTooltipArgs,
    NodeTooltipArgs,
    Sankey,
    SankeyLink,
    SankeyNode,
    SankeyTooltip,
} from "./Sankey.js"
import {
    aggregateBySide,
    assignColors,
    DEFAULT_MAX_NODES,
    DEFAULT_MIN_LINK_SHARE,
    DEFAULT_MIN_NODE_SHARE,
    getEntityFromNodeId,
    getEntityShortLabel,
    EntityTotal,
    Flow,
    makeSourceId,
    makeTargetId,
    makeValueLabel,
    NEUTRAL_COLOR,
    OTHER_KEY,
} from "./SankeyHelpers.js"

interface BilateralFlowSankeyProps {
    flows: Flow[]
    width: number
    height: number
    maxNodes?: number
    minNodeShare?: number
    minLinkShare?: number
    getTooltip?: (args: BilateralTooltipArgs) => SankeyTooltip | undefined
    onSelectEntity?: (entity: string, side: LinkSide) => void
    formatValue: (value: number) => string
}

export type BilateralTooltipArgs = {
    side: LinkSide
    entity: string
    partners: EntityTotal[]
    flows: Flow[]
}

export function BilateralFlowSankey({
    flows,
    width,
    height,
    maxNodes = DEFAULT_MAX_NODES,
    minNodeShare = DEFAULT_MIN_NODE_SHARE,
    minLinkShare = DEFAULT_MIN_LINK_SHARE,
    getTooltip,
    onSelectEntity,
    formatValue,
}: BilateralFlowSankeyProps) {
    const { sourceNodes, targetNodes, links } = useMemo(
        () =>
            buildBilateral({
                flows,
                maxNodes,
                minNodeShare,
                minLinkShare,
                formatValue,
            }),
        [flows, maxNodes, minNodeShare, minLinkShare, formatValue]
    )

    const getEntityIdsFromNodes = (nodes: SankeyNode[]) =>
        nodes
            .map((n) => getEntityFromNodeId(n.id))
            .filter((e) => e !== OTHER_KEY)

    const sourceIds = useMemo(
        () => getEntityIdsFromNodes(sourceNodes),
        [sourceNodes]
    )
    const targetIds = useMemo(
        () => getEntityIdsFromNodes(targetNodes),
        [targetNodes]
    )

    const sourceIdSet = useMemo(() => new Set(sourceIds), [sourceIds])
    const targetIdSet = useMemo(() => new Set(targetIds), [targetIds])

    const colorMap = useMemo(() => assignColors(sourceIds), [sourceIds])

    const getNodeColor = (node: SankeyNode): string => {
        // Only source nodes are colored
        if (node.id.startsWith("target:")) return NEUTRAL_COLOR
        const source = getEntityFromNodeId(node.id)
        return colorMap.get(source) ?? NEUTRAL_COLOR
    }

    const getLinkColor = (link: SankeyLink): string => {
        // Flows inherit the source's color.
        const source = getEntityFromNodeId(link.source)
        return colorMap.get(source) ?? NEUTRAL_COLOR
    }

    // All other links sharing the hovered link's source
    const getRelatedLinks = (link: SankeyLink): SankeyLink[] =>
        links.filter(
            (l) => l.source === link.source && l.target !== link.target
        )

    // Rows whose entity on `side` matches `entityId` exactly
    const getFlowsForEntity = (side: LinkSide, entityId: string): Flow[] =>
        flows.filter((r) => r[side] === entityId)

    // Rows in the Other bucket on `side`, i.e. every row whose entity on
    // that side was folded into "Other" (not in the visible top-N)
    const getFlowsForOtherBucket = (side: LinkSide): Flow[] => {
        const topSet = side === "source" ? sourceIdSet : targetIdSet
        return flows.filter((r) => !topSet.has(r[side]))
    }

    const getNodeTooltip = getTooltip
        ? ({ node }: NodeTooltipArgs): SankeyTooltip | undefined => {
              const side = node.id.startsWith("target:") ? "target" : "source"
              const entityId = getEntityFromNodeId(node.id)
              const flows =
                  entityId === OTHER_KEY
                      ? getFlowsForOtherBucket(side)
                      : getFlowsForEntity(side, entityId)
              return getTooltip(buildTooltipArgs({ side, entityId, flows }))
          }
        : undefined

    const getLinkTooltip = getTooltip
        ? ({ link }: LinkTooltipArgs): SankeyTooltip | undefined => {
              // Link hover always resolves to the source side
              const side = "source"
              const entityId = getEntityFromNodeId(link.source)
              const flows =
                  entityId === OTHER_KEY
                      ? getFlowsForOtherBucket(side)
                      : getFlowsForEntity(side, entityId)
              return getTooltip(buildTooltipArgs({ side, entityId, flows }))
          }
        : undefined

    const handleNodeClick = onSelectEntity
        ? (node: SankeyNode) => {
              const side: LinkSide = node.id.startsWith("target:")
                  ? "target"
                  : "source"
              onSelectEntity(getEntityFromNodeId(node.id), side)
          }
        : undefined

    const handleLinkClick = onSelectEntity
        ? (link: SankeyLink) =>
              onSelectEntity(getEntityFromNodeId(link.source), "source")
        : undefined

    // Other isn't a single entity, so it can't be drilled into
    const isNodeClickable = (node: SankeyNode): boolean =>
        getEntityFromNodeId(node.id) !== OTHER_KEY

    // Likewise, links out of the Other source bucket can't be drilled into
    const isLinkClickable = (link: SankeyLink): boolean =>
        getEntityFromNodeId(link.source) !== OTHER_KEY

    const nodes = [...sourceNodes, ...targetNodes]

    return (
        <Sankey
            nodes={nodes}
            links={links}
            width={width}
            height={height}
            nodeColor={getNodeColor}
            linkColor={getLinkColor}
            getLinkTooltip={getLinkTooltip}
            getRelatedLinks={getTooltip ? getRelatedLinks : undefined}
            getNodeTooltip={getNodeTooltip}
            onNodeClick={handleNodeClick}
            isNodeClickable={onSelectEntity ? isNodeClickable : undefined}
            onLinkClick={handleLinkClick}
            isLinkClickable={onSelectEntity ? isLinkClickable : undefined}
        />
    )
}

function buildTooltipArgs({
    side,
    entityId,
    flows,
}: {
    side: LinkSide
    entityId: string
    flows: Flow[]
}): BilateralTooltipArgs {
    const entity = entityId === OTHER_KEY ? "Other" : entityId
    const partnerKey = match(side)
        .with("source", () => "target" as const)
        .with("target", () => "source" as const)
        .exhaustive()

    const partners = aggregateBySide(flows, partnerKey)
    const sortedFlows = R.sortBy(flows, [(f) => f.value, "desc"])

    return { side, entity, partners, flows: sortedFlows }
}

export function selectTopEntities({
    flows,
    side,
    maxNodes,
    minNodeShare,
    showAllOtherBelow = 0,
}: {
    flows: Flow[]
    side: LinkSide
    maxNodes: number
    minNodeShare: number
    /**
     * When the Other bucket would contain this many entries or fewer,
     * fold them back into `top` instead so the chart shows each
     * individually
     */
    showAllOtherBelow?: number
}): {
    top: EntityTotal[]
    other: EntityTotal[]
    total: number
} {
    const sortedEntities = aggregateBySide(flows, side)

    const total = R.sumBy(sortedEntities, (d) => d.total)

    const topCandidates = R.take(sortedEntities, maxNodes)
    const topCandidatesAboveFloor = topCandidates.filter(
        (d) => total > 0 && d.total / total >= minNodeShare
    )
    let top =
        topCandidatesAboveFloor.length > 0
            ? topCandidatesAboveFloor
            : R.take(topCandidates, 1)
    let other = R.drop(sortedEntities, top.length)

    // Inline a small Other tail
    if (other.length > 0 && other.length <= showAllOtherBelow) {
        top = [...top, ...other]
        other = []
    }

    return { top, other, total }
}

function buildBilateral({
    flows,
    maxNodes,
    minNodeShare,
    minLinkShare,
    formatValue,
}: {
    flows: Flow[]
    maxNodes: number
    minNodeShare: number
    minLinkShare: number
    formatValue: (value: number) => string
}): {
    sourceNodes: SankeyNode[]
    targetNodes: SankeyNode[]
    links: SankeyLink[]
} {
    const sourceSelection = selectTopEntities({
        flows,
        side: "source",
        maxNodes,
        minNodeShare,
    })
    const targetSelection = selectTopEntities({
        flows,
        side: "target",
        maxNodes,
        minNodeShare,
    })

    const total = Math.max(sourceSelection.total, targetSelection.total)
    if (total === 0) return { sourceNodes: [], targetNodes: [], links: [] }

    const topSources = new Set(sourceSelection.top.map((d) => d.entity))
    const topTargets = new Set(targetSelection.top.map((d) => d.entity))

    // Aggregate row values into (source, target) pairs.
    // Non-top entities collapse into the Other buckets per side.
    const pairsByKey = new Map<string, Flow>()
    for (const row of flows) {
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

    const sourceNodes = buildColumnNodes({
        selection: sourceSelection,
        visiblePairs,
        side: "source",
        makeNodeId: makeSourceId,
        formatValue,
    })
    const targetNodes = buildColumnNodes({
        selection: targetSelection,
        visiblePairs,
        side: "target",
        makeNodeId: makeTargetId,
        formatValue,
    })

    const links: SankeyLink[] = visiblePairs.map((p) => ({
        source: makeSourceId(p.source),
        target: makeTargetId(p.target),
        value: p.value,
    }))

    return { sourceNodes, targetNodes, links }
}

function buildColumnNodes({
    selection,
    visiblePairs,
    side,
    makeNodeId,
    formatValue,
}: {
    selection: { top: EntityTotal[]; total: number }
    visiblePairs: Flow[]
    side: LinkSide
    makeNodeId: (entity: string) => string
    formatValue: (v: number) => string
}): SankeyNode[] {
    const activeEntities = new Set(visiblePairs.map((p) => p[side]))
    const topNodes = selection.top
        .filter((d) => activeEntities.has(d.entity))
        .map((d) => ({
            id: makeNodeId(d.entity),
            label: getEntityShortLabel(d.entity),
            valueLabel: makeValueLabel({
                value: d.total,
                total: selection.total,
                formatValue,
            }),
        }))

    const otherNode: SankeyNode[] = activeEntities.has(OTHER_KEY)
        ? [{ id: makeNodeId(OTHER_KEY), label: "Other" }]
        : []

    return [...topNodes, ...otherNode]
}
