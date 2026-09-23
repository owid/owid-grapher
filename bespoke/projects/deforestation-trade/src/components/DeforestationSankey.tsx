import { useCallback, useMemo } from "react"
import * as R from "remeda"

import { OwidDistinctColors } from "@ourworldindata/grapher"
import { articulateEntity } from "@ourworldindata/utils"
import {
    TooltipTable,
    TooltipValue,
} from "@ourworldindata/grapher/src/tooltip/TooltipContents.js"

import { ResponsiveContainer } from "../../../../components/ResponsiveContainer/ResponsiveContainer.js"
import {
    Sankey,
    type LinkTooltipArgs,
    type NodeTooltipArgs,
    type SankeyLink,
    type SankeyNode,
    type SankeyTooltip,
} from "../../../../components/Sankey/Sankey.js"
import {
    getEntityShortLabel,
    NEUTRAL_COLOR,
    type EntityTotal,
} from "../../../../components/Sankey/SankeyHelpers.js"
import {
    DEFAULT_FONT_SETTINGS,
    MOBILE_FONT_SETTINGS,
    SANKEY_NODE_PADDING,
} from "../../../../components/Sankey/SplitFlowSankey.js"

import {
    buildCountryGraph,
    getGroupFromNodeId,
    getPartnerFromNodeId,
    getPartnerKeyFromNodeId,
    makeGroupId,
    makePartnerId,
    isDomesticNodeId,
    isFocusNodeId,
    isOtherNodeId,
    type SankeyGraph,
} from "../core/buildGraph.js"
import {
    getGroupColor,
    getGroupDescription,
    getGroupLabel,
    GroupIcon,
    renderGroupIcon,
} from "../core/commodityGroups.js"
import {
    capItems,
    formatHectares,
    formatShare,
    formatYearRange,
    possessiveEntity,
} from "../core/helpers.js"
import type { YearRange } from "../core/types.js"
import type { DeforestationChartProps } from "./DeforestationChart.js"

/** Commodity groups below this share of the column are not labelled in the
 *  chart — their labels would pile up; their tooltips still name them */
const MIN_LABELLED_GROUP_SHARE = 0.05

/** On narrow screens no commodity group is labelled in the chart: the nodes
 *  carry only their icons, and their tooltips name them */
const LABEL_NO_GROUPS = Infinity

/** Group icons in tooltips are bigger than the ones beside the chart's labels */
const TOOLTIP_GROUP_ICON_SIZE = 28

/** Links below this share of the chart's total are drawn extra faint */
const LINK_LOW_VOLUME_THRESHOLD = 0.005

/** Rows of a tooltip breakdown table are always hectares */
const TOOLTIP_TABLE_COLUMNS = [
    {
        label: "hectares",
        formatValue: (v: unknown): string =>
            typeof v === "number" ? formatHectares(v) : "",
    },
]

export type DeforestationSankeyProps = Pick<
    DeforestationChartProps,
    | "view"
    | "country"
    | "yearRange"
    | "importRows"
    | "exportRows"
    | "setCountry"
    | "setView"
    | "isNarrow"
>

export function DeforestationSankey(
    props: DeforestationSankeyProps
): React.ReactElement {
    return (
        <div className="deforestation-sankey">
            <ResponsiveContainer>
                {(dimensions) => (
                    <DeforestationSankeyContent {...props} {...dimensions} />
                )}
            </ResponsiveContainer>
        </div>
    )
}

function DeforestationSankeyContent({
    view,
    country,
    yearRange,
    importRows,
    exportRows,
    setCountry,
    setView,
    isNarrow,
    width,
    height,
}: DeforestationSankeyProps & {
    width: number
    height: number
}): React.ReactElement {
    // Node labels sit between three columns, so they use the short unit;
    // tooltips spell the numbers out
    const formatValue = useCallback(
        (v: number) => formatHectares(v, { short: true }),
        []
    )

    const graph = useMemo<SankeyGraph>(
        () =>
            buildCountryGraph({
                rows: view === "consumption" ? importRows : exportRows,
                country,
                view,
                formatValue,
                getGroupLabel,
                minLabelledGroupShare: isNarrow
                    ? LABEL_NO_GROUPS
                    : MIN_LABELLED_GROUP_SHARE,
            }),
        [view, country, importRows, exportRows, formatValue, isNarrow]
    )

    // Labelled commodity nodes carry their group's glyph next to the label.
    // On narrow screens the glyph stands alone; the Sankey drops it on nodes
    // too short to fit it.
    const nodes = useMemo<SankeyNode[]>(
        () =>
            graph.nodes.map((node) => {
                const group = getGroupFromNodeId(node.id)
                if (group === undefined) return node
                if (node.label === "" && !isNarrow) return node
                return {
                    ...node,
                    icon: renderGroupIcon(group, getGroupColor(group)),
                }
            }),
        [graph.nodes, isNarrow]
    )

    const countryLabel = getEntityShortLabel(country)

    /** Display label per node; the focus node is named by its column heading */
    const labelById = useMemo(() => {
        const map = new Map<string, string>()
        for (const node of graph.nodes) {
            const group = getGroupFromNodeId(node.id)
            map.set(
                node.id,
                isFocusNodeId(node.id)
                    ? countryLabel
                    : group !== undefined
                      ? getGroupLabel(group)
                      : node.label
            )
        }
        return map
    }, [graph.nodes, countryLabel])

    /** Which side of the chart a node sits on, from the links touching it */
    const nodeSides = useMemo(() => {
        const sources = new Set(graph.links.map((l) => l.source))
        const targets = new Set(graph.links.map((l) => l.target))
        return { sources, targets }
    }, [graph.links])

    /** A commodity group's links, split by layer */
    // Every ribbon belongs to one partner: on the partner layer through its
    // endpoint, on the focus layer through the link's category. Index each
    // partner's links across both layers, so hovering any of them — or the
    // partner's node — lights the partner's whole path and shows its tooltip.
    const partnerKeyOfLink = useCallback(
        (link: SankeyLink): string | undefined =>
            link.category ??
            getPartnerKeyFromNodeId(link.source) ??
            getPartnerKeyFromNodeId(link.target),
        []
    )
    const linksByPartner = useMemo(() => {
        const map = new Map<string, SankeyLink[]>()
        for (const link of graph.links) {
            const partnerKey = partnerKeyOfLink(link)
            if (partnerKey === undefined) continue
            map.set(partnerKey, [...(map.get(partnerKey) ?? []), link])
        }
        return map
    }, [graph.links, partnerKeyOfLink])

    // The commodity column's links, per group, for treating a ribbon as its
    // commodity
    const linksByGroup = useMemo(() => {
        const map = new Map<string, SankeyLink[]>()
        for (const link of graph.links) {
            const group =
                getGroupFromNodeId(link.source) ??
                getGroupFromNodeId(link.target)
            if (group === undefined) continue
            map.set(group, [...(map.get(group) ?? []), link])
        }
        return map
    }, [graph.links])

    // A ribbon between the partners and the commodities stands for its
    // partner; one between the commodities and the selected country — where
    // every partner's band runs into the same node — stands for its commodity
    const isFocusLayerLink = (link: SankeyLink): boolean =>
        isFocusNodeId(link.source) || isFocusNodeId(link.target)
    const isSameLink = (a: SankeyLink, b: SankeyLink): boolean =>
        a.source === b.source &&
        a.target === b.target &&
        a.category === b.category

    const getRelatedLinks = useCallback(
        (link: SankeyLink): SankeyLink[] => {
            const key = isFocusLayerLink(link)
                ? (getGroupFromNodeId(link.source) ??
                  getGroupFromNodeId(link.target))
                : partnerKeyOfLink(link)
            if (key === undefined) return []
            const family = isFocusLayerLink(link)
                ? linksByGroup.get(key)
                : linksByPartner.get(key)
            return (family ?? []).filter((l) => !isSameLink(l, link))
        },
        [linksByGroup, linksByPartner, partnerKeyOfLink]
    )

    // A partner node lights its whole path through the commodity column; a
    // commodity node's own links already are the whole commodity
    const getRelatedLinksForNode = useCallback(
        ({ node }: NodeTooltipArgs): SankeyLink[] => {
            const partnerKey = getPartnerKeyFromNodeId(node.id)
            return partnerKey === undefined
                ? []
                : (linksByPartner.get(partnerKey) ?? [])
        },
        [linksByPartner]
    )

    const getNodeColor = useCallback((node: SankeyNode): string => {
        const group = getGroupFromNodeId(node.id)
        if (group !== undefined) return getGroupColor(group)
        if (isDomesticNodeId(node.id)) return OwidDistinctColors.Denim
        return NEUTRAL_COLOR
    }, [])

    // Every link touches the commodity column and takes its group's colour
    const getLinkColor = useCallback((link: SankeyLink): string => {
        const group =
            getGroupFromNodeId(link.source) ?? getGroupFromNodeId(link.target)
        return group !== undefined ? getGroupColor(group) : NEUTRAL_COLOR
    }, [])

    const isNodeClickable = useCallback(
        (node: SankeyNode): boolean =>
            getPartnerFromNodeId(node.id) !== undefined,
        []
    )

    const onNodeClick = useCallback(
        (node: SankeyNode): void => {
            const partner = getPartnerFromNodeId(node.id)
            if (partner === undefined) return
            setCountry(partner)
            // Keep the reader moving with the flow: a producer on the left
            // opens on its exports, a consumer on the right on its imports.
            setView(
                nodeSides.sources.has(node.id) ? "production" : "consumption"
            )
        },
        [nodeSides, setCountry, setView]
    )

    // The focus node is named by its column heading, so it has nothing to say
    const isNodeHoverable = useCallback(
        (node: SankeyNode): boolean => !isFocusNodeId(node.id),
        []
    )

    const getNodeTooltip = useCallback(
        (args: NodeTooltipArgs): SankeyTooltip | undefined =>
            makeNodeTooltip({
                ...args,
                labelById,
                graph,
                yearRange,
            }),
        [labelById, graph, yearRange]
    )

    // A ribbon gets the tooltip of what it stands for: its commodity on the
    // selected country's side, its partner on the partners' side — built
    // from the links that touch that node
    const getLinkTooltip = useCallback(
        ({ link }: LinkTooltipArgs): SankeyTooltip | undefined => {
            let nodeId: string
            let nodeLinks: SankeyLink[]
            if (isFocusLayerLink(link)) {
                const group =
                    getGroupFromNodeId(link.source) ??
                    getGroupFromNodeId(link.target)
                if (group === undefined) return undefined
                nodeId = makeGroupId(group)
                nodeLinks = linksByGroup.get(group) ?? []
            } else {
                const partnerKey = partnerKeyOfLink(link)
                if (partnerKey === undefined) return undefined
                nodeId = makePartnerId(partnerKey)
                nodeLinks = (linksByPartner.get(partnerKey) ?? []).filter(
                    (l) => l.category === undefined
                )
            }
            return makeNodeTooltip({
                node: { id: nodeId, label: labelById.get(nodeId) ?? "" },
                incomingLinks: nodeLinks.filter((l) => l.target === nodeId),
                outgoingLinks: nodeLinks.filter((l) => l.source === nodeId),
                labelById,
                graph,
                yearRange,
            })
        },
        [
            partnerKeyOfLink,
            linksByGroup,
            linksByPartner,
            labelById,
            graph,
            yearRange,
        ]
    )

    const headingFallbacks = useMemo(() => [graph.headings], [graph.headings])

    return (
        <div className="deforestation-sankey__chart-area">
            <Sankey
                nodes={nodes}
                links={graph.links}
                width={width}
                height={height}
                // In production view the wide, simple ribbons are on the left
                // of the commodity bar; in consumption view on the right —
                // put the labels over those
                middleLabelSide={view === "production" ? "left" : "right"}
                // The sentence when it fits, the short labels when it doesn't
                columnHeadings={graph.headingSentence}
                columnHeadingFallbacks={headingFallbacks}
                totalFlowVolume={graph.total}
                linkLowVolumeThreshold={LINK_LOW_VOLUME_THRESHOLD}
                nodePadding={SANKEY_NODE_PADDING}
                fontSettings={
                    isNarrow ? MOBILE_FONT_SETTINGS : DEFAULT_FONT_SETTINGS
                }
                nodeColor={getNodeColor}
                linkColor={getLinkColor}
                // Every band on the selected country's side runs into the same
                // node, so a faded one would show as a pale stripe through its
                // commodity's ribbon
                canFadeLowVolumeLink={(link) => !isFocusLayerLink(link)}
                getRelatedLinks={getRelatedLinks}
                getRelatedLinksForNode={getRelatedLinksForNode}
                getLinkTooltip={getLinkTooltip}
                getNodeTooltip={getNodeTooltip}
                isNodeHoverable={isNodeHoverable}
                isNodeClickable={isNodeClickable}
                onNodeClick={onNodeClick}
            />
        </div>
    )
}

// ---------------------------------------------------------------------------
// Tooltips
// ---------------------------------------------------------------------------

function makeNodeTooltip({
    node,
    incomingLinks,
    outgoingLinks,
    labelById,
    graph,
    yearRange,
}: NodeTooltipArgs & {
    labelById: Map<string, string>
    graph: SankeyGraph
    yearRange: YearRange
}): SankeyTooltip | undefined {
    if (isFocusNodeId(node.id)) return undefined

    const subtitle = formatYearRange(yearRange)
    const value = Math.max(sumLinks(incomingLinks), sumLinks(outgoingLinks))
    const share = <ValueWithShare value={value} total={graph.total} />

    const group = getGroupFromNodeId(node.id)
    if (group !== undefined) {
        // Partners sit on whichever side isn't the focus country
        const isPartnerSideIncoming = incomingLinks.some(
            (l) => !isFocusNodeId(l.source)
        )
        const partnerLinks = isPartnerSideIncoming
            ? incomingLinks
            : outgoingLinks
        // The breakdown lists each partner once
        const rows = sumByKey(partnerLinks, (link) =>
            isPartnerSideIncoming ? link.source : link.target
        ).map(([id, value]) => ({ id, value }))

        const description = getGroupDescription(group)
        const shareOfTotal = graph.total > 0 ? value / graph.total : 0
        // "of Brazil's total": the chart is about the selected country
        const countryLabel = [...labelById].find(([id]) =>
            isFocusNodeId(id)
        )?.[1]
        const ofTotal = countryLabel
            ? `of ${possessiveEntity(articulateEntity(countryLabel))} total`
            : "of the total"
        return {
            title: getGroupLabel(group),
            subtitle,
            content: (
                <>
                    {description && (
                        <p className="deforestation-sankey__tooltip-description">
                            {description}
                        </p>
                    )}
                    <GroupLine group={group}>
                        <div className="deforestation-sankey__tooltip-headline">
                            <span className="deforestation-sankey__tooltip-headline-value">
                                {formatHectares(value)}
                            </span>
                            {formatShare(shareOfTotal) && (
                                <span className="deforestation-sankey__tooltip-headline-share">
                                    {formatShare(shareOfTotal)} {ofTotal}
                                </span>
                            )}
                        </div>
                    </GroupLine>
                    <PartnerShareTable
                        heading={
                            isPartnerSideIncoming
                                ? "Produced in"
                                : "Consumed in"
                        }
                        color={getGroupColor(group)}
                        total={value}
                        rows={R.pipe(
                            rows,
                            // Largest first, with the "Other countries" rest last
                            R.sortBy(
                                [(r) => isOtherNodeId(r.id), "asc"],
                                [(r) => r.value, "desc"]
                            ),
                            R.map((r) => ({
                                name: labelById.get(r.id) ?? r.id,
                                value: r.value,
                            }))
                        )}
                    />
                </>
            ),
        }
    }

    if (isOtherNodeId(node.id)) {
        const side = outgoingLinks.length > 0 ? "left" : "right"
        const breakdown: EntityTotal[] = graph.otherBreakdown[side]
        return {
            title: "Other countries",
            subtitle,
            content: (
                <>
                    {share}
                    <BreakdownTable
                        rows={breakdown.map((d) => ({
                            name: getEntityShortLabel(d.entity),
                            value: d.total,
                        }))}
                    />
                </>
            ),
        }
    }

    // A partner country: break its flows down by commodity
    const partnerLinks = [...incomingLinks, ...outgoingLinks]
    return {
        title: labelById.get(node.id) ?? node.label,
        subtitle,
        content: (
            <>
                {share}
                <CommodityBreakdownTable
                    rows={R.pipe(
                        sumByKey(
                            partnerLinks,
                            (link) =>
                                getGroupFromNodeId(link.source) ??
                                getGroupFromNodeId(link.target) ??
                                ""
                        ),
                        R.map(([group, value]) => ({ group, value })),
                        R.sortBy([(r) => r.value, "desc"])
                    )}
                />
            </>
        ),
    }
}

/** A commodity group's icon beside the value line — the tooltip card's title
 *  is plain text, so this is where the icon goes */
function GroupLine({
    group,
    children,
}: {
    group: string
    children?: React.ReactNode
}): React.ReactElement {
    return (
        <div className="deforestation-sankey__tooltip-group">
            <GroupIcon
                group={group}
                size={TOOLTIP_GROUP_ICON_SIZE}
                className="deforestation-sankey__tooltip-group-icon"
            />
            {children}
        </div>
    )
}

/** A partner's flows by commodity group, each row led by the group's icon */
function CommodityBreakdownTable({
    rows,
}: {
    rows: { group: string; value: number }[]
}): React.ReactElement | null {
    const { visible, hiddenCount } = capItems(rows)
    if (visible.length === 0) return null

    return (
        <>
            <table className="deforestation-sankey__commodity-table">
                <tbody>
                    {visible.map((row) => (
                        <tr key={row.group}>
                            <td className="deforestation-sankey__commodity-table-icon">
                                <GroupIcon group={row.group} size={14} />
                            </td>
                            <td className="deforestation-sankey__commodity-table-name">
                                {getGroupLabel(row.group)}
                            </td>
                            <td className="deforestation-sankey__commodity-table-value">
                                {formatHectares(row.value)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {hiddenCount > 0 && (
                <div className="deforestation-sankey__tooltip-more">
                    + {hiddenCount} more
                </div>
            )}
        </>
    )
}

/**
 * A commodity's partners, each with its hectares, its share of the commodity
 * and a bar in the commodity's colour scaled to the largest row
 */
function PartnerShareTable({
    heading,
    color,
    total,
    rows,
}: {
    heading: string
    color: string
    total: number
    rows: { name: string; value: number }[]
}): React.ReactElement | null {
    const { visible, hiddenCount } = capItems(rows)
    if (visible.length === 0) return null
    const maxValue = Math.max(...visible.map((r) => r.value))

    return (
        <>
            <div className="deforestation-sankey__tooltip-section-heading">
                {heading}
            </div>
            <table className="deforestation-sankey__share-table">
                <tbody>
                    {visible.map((row) => (
                        <tr key={row.name}>
                            <td className="deforestation-sankey__share-table-name">
                                {row.name}
                            </td>
                            <td className="deforestation-sankey__share-table-bar">
                                <div
                                    className="deforestation-sankey__share-table-bar-fill"
                                    style={{
                                        width: `${maxValue > 0 ? (row.value / maxValue) * 100 : 0}%`,
                                        backgroundColor: color,
                                    }}
                                />
                            </td>
                            <td className="deforestation-sankey__share-table-value">
                                {formatHectares(row.value, { short: true })}
                            </td>
                            <td className="deforestation-sankey__share-table-share">
                                {total > 0
                                    ? formatShare(row.value / total)
                                    : ""}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {hiddenCount > 0 && (
                <div className="deforestation-sankey__tooltip-more">
                    + {hiddenCount} more{" "}
                    {hiddenCount === 1 ? "country" : "countries"}
                </div>
            )}
        </>
    )
}

function ValueWithShare({
    value,
    total,
}: {
    value: number
    total: number
}): React.ReactElement {
    const share = total > 0 ? formatShare(value / total) : ""
    return (
        <TooltipValue
            value={
                <span>
                    {formatHectares(value)}
                    {share && ` (${share})`}
                </span>
            }
        />
    )
}

function BreakdownTable({
    rows,
}: {
    rows: { name: string; value: number; color?: string }[]
}): React.ReactElement | null {
    const { visible, hiddenCount } = capItems(rows)
    if (visible.length === 0) return null

    return (
        <>
            <TooltipTable
                columns={TOOLTIP_TABLE_COLUMNS}
                rows={visible.map((row) => ({
                    name: row.name,
                    values: [row.value],
                    swatch: row.color ? { color: row.color } : undefined,
                }))}
            />
            {hiddenCount > 0 && (
                <div className="deforestation-sankey__tooltip-more">
                    + {hiddenCount} more{" "}
                    {hiddenCount === 1 ? "country" : "countries"}
                </div>
            )}
        </>
    )
}

function sumLinks(links: SankeyLink[]): number {
    return R.sumBy(links, (l) => l.value)
}

/** Total link value per key, in first-seen key order */
function sumByKey(
    links: SankeyLink[],
    keyOf: (link: SankeyLink) => string
): [string, number][] {
    const totals = new Map<string, number>()
    for (const link of links) {
        const key = keyOf(link)
        totals.set(key, (totals.get(key) ?? 0) + link.value)
    }
    return [...totals]
}
