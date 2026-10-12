import { useState } from "react"
import cx from "clsx"
import {
    EnrichedBlockPeerRanking,
    EntityCode,
    RankingSortOrder,
} from "@ourworldindata/types"
import {
    checkIsVeryShortUnit,
    computeRankSummary,
    defaultPeerGroupsForEntity,
    formatOrdinal,
    getEntityCodeFromChartUrl,
    RankedRow,
    rankRows,
    RankSummary,
    WORLD_PEER_GROUP_NAME,
} from "@ourworldindata/utils"
import { DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID } from "@ourworldindata/components"
import {
    useBlockRankings,
    useLinkedChart,
    useShouldRankingBlockRender,
} from "../utils.js"
import { PeerGroupToggle } from "./PeerGroupToggle.js"
import {
    computePeerGroupSummary,
    formatRankingValue,
    getArticulatedEntityName,
    getEntityName,
    getInlineUnit,
    getRankingUnit,
    makeNiceAxis,
    makePeerGroupOption,
    median,
    PeerGroupOption,
    scaleToUnit,
    stripMarkdownLinks,
} from "./rankingUtils.js"

/** Groups up to this size are always listed in full */
const MAX_ROWS_COLLAPSED = 12
/** When collapsed, show this many top rows… */
const TOP_ROWS_COLLAPSED = 3
/** …and this many rows above and below the entity */
const ENTITY_CONTEXT_ROWS = 2

type VisibleRow =
    | { type: "row"; rankedRow: RankedRow }
    | { type: "gap"; count: number }

/**
 * For large groups (e.g. World), show the top rows, the rows around the
 * entity, and the last row, with gaps in between.
 */
function selectVisibleRows(
    rankedRows: RankedRow[],
    entityCode: EntityCode,
    isExpanded: boolean
): VisibleRow[] {
    if (isExpanded || rankedRows.length <= MAX_ROWS_COLLAPSED)
        return rankedRows.map((rankedRow) => ({ type: "row", rankedRow }))

    const entityIndex = rankedRows.findIndex(
        ({ row }) => row.code === entityCode
    )
    const keep = new Set<number>()
    for (let i = 0; i < TOP_ROWS_COLLAPSED; i++) keep.add(i)
    for (
        let i = entityIndex - ENTITY_CONTEXT_ROWS;
        i <= entityIndex + ENTITY_CONTEXT_ROWS;
        i++
    )
        if (i >= 0 && i < rankedRows.length) keep.add(i)
    keep.add(rankedRows.length - 1)

    const visible: VisibleRow[] = []
    let gap = 0
    rankedRows.forEach((rankedRow, index) => {
        if (!keep.has(index)) {
            gap++
            return
        }
        if (gap > 0) visible.push({ type: "gap", count: gap })
        gap = 0
        visible.push({ type: "row", rankedRow })
    })
    return visible
}

const formatOf = (total: number, sort: RankingSortOrder): string =>
    sort === "lowest" ? `lowest of ${total}` : `of ${total}`

function formatShare(summary: RankSummary, sort: RankingSortOrder): string {
    const fromTop = summary.topPercent
    const fromBottom = Math.ceil(
        ((summary.total - summary.rank + 1) / summary.total) * 100
    )
    const [top, bottom] =
        sort === "highest" ? ["Top", "Bottom"] : ["Lowest", "Highest"]
    return fromTop <= 50
        ? `${top} ${fromTop}% worldwide`
        : `${bottom} ${fromBottom}% worldwide`
}

/**
 * Where an entity ranks for a single indicator, among a choice of peer
 * groups and worldwide, with a ranked dot plot of the group's countries.
 */
export function PeerRanking({
    block,
    className,
}: {
    block: EnrichedBlockPeerRanking
    className?: string
}) {
    const [blockRanking] = useBlockRankings(block)
    const ranking = blockRanking?.ranking
    const entityCode = getEntityCodeFromChartUrl(block.url)
    const shouldRender = useShouldRankingBlockRender(block, entityCode)
    const { linkedChart } = useLinkedChart(block.url)
    const [selectedGroupName, setSelectedGroupName] = useState<string>()
    const [isExpanded, setIsExpanded] = useState(false)

    if (!shouldRender || !ranking || !entityCode) return null

    const worldSummary = computeRankSummary(ranking, entityCode, block.sort)
    if (!worldSummary) return null

    const groupNames =
        block.groups.length > 0
            ? block.groups
            : defaultPeerGroupsForEntity(entityCode)
    const availableGroups = groupNames
        .map((name) => ({
            option: makePeerGroupOption(name, entityCode),
            result: computePeerGroupSummary(
                ranking,
                entityCode,
                block.sort,
                name
            ),
        }))
        .filter(
            (
                group
            ): group is {
                option: PeerGroupOption
                result: NonNullable<typeof group.result>
            } => group.result !== undefined
        )
    if (availableGroups.length === 0) {
        availableGroups.push({
            option: makePeerGroupOption(WORLD_PEER_GROUP_NAME, entityCode),
            result: {
                summary: worldSummary,
                groupCodes: new Set(ranking.rows.map((row) => row.code)),
            },
        })
    }
    const selectedGroup =
        availableGroups.find(
            (group) => group.option.name === selectedGroupName
        ) ?? availableGroups[0]
    const { option, result } = selectedGroup
    const { summary, groupCodes } = result

    const entityName = getEntityName(entityCode)
    const groupRows = ranking.rows.filter((row) => groupCodes.has(row.code))
    const rankedRows = rankRows(groupRows, block.sort)
    const values = groupRows.map((row) => row.value)
    // Rows show the unit next to the value if it's short enough, e.g. "81.4
    // years" or "52%", otherwise the axis is labelled with it
    const unit = getRankingUnit(ranking)
    const rowUnit = getInlineUnit(unit)
    const axisUnit = unit !== rowUnit ? unit : undefined
    const axis = makeNiceAxis(
        Math.min(...values),
        Math.max(...values),
        undefined,
        rowUnit && checkIsVeryShortUnit(rowUnit) ? rowUnit : undefined
    )
    const groupMedian = median(values)
    const position = (value: number): string =>
        `${(scaleToUnit(value, axis.domain) * 100).toFixed(2)}%`
    const visibleRows = selectVisibleRows(rankedRows, entityCode, isExpanded)
    const formatRow = (value: number): string =>
        formatRankingValue(value, { unit: rowUnit })
    // Size the value column to the longest value shown (in digit widths)
    const valueColumnWidth = Math.max(
        ...visibleRows.map((visibleRow) =>
            visibleRow.type === "row"
                ? formatRow(visibleRow.rankedRow.row.value).length
                : 0
        )
    )
    const isCollapsible = rankedRows.length > MAX_ROWS_COLLAPSED

    const title = `${block.title ?? ranking.title}, ${ranking.formattedTime}`
    const subtitle = linkedChart?.subtitle
        ? stripMarkdownLinks(linkedChart.subtitle)
        : undefined
    const exploreUrl = linkedChart?.resolvedUrl ?? block.url
    const learnMoreUrl =
        linkedChart?.indicatorId !== undefined
            ? `${exploreUrl}#${DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID}`
            : undefined

    const onGroupChange = (name: string): void => {
        setSelectedGroupName(name)
        setIsExpanded(false)
    }

    return (
        <section className={cx("peer-ranking", className)}>
            <header className="peer-ranking__header">
                <span className="peer-ranking__kicker">
                    How {getArticulatedEntityName(entityCode)} ranks
                </span>
                <h2 className="peer-ranking__title">{title}</h2>
                {subtitle && (
                    <p className="peer-ranking__subtitle">{subtitle}</p>
                )}
            </header>

            <div className="peer-ranking__stats">
                {!option.isAllCountries && (
                    <RankStat
                        label={`Among ${option.description}`}
                        rank={summary.rank}
                        of={formatOf(summary.total, block.sort)}
                    />
                )}
                <RankStat
                    label="Worldwide"
                    rank={worldSummary.rank}
                    of={`${formatOf(worldSummary.total, block.sort)} countries`}
                />
                <span className="peer-ranking__share-pill">
                    {formatShare(worldSummary, block.sort)}
                </span>
            </div>

            <div className="peer-ranking__controls">
                <PeerGroupToggle
                    options={availableGroups.map((group) => group.option)}
                    selected={option.name}
                    onChange={onGroupChange}
                />
                <div className="peer-ranking__legend" aria-hidden="true">
                    <span className="peer-ranking__legend-item peer-ranking__legend-item--entity">
                        {entityName}
                    </span>
                    <span className="peer-ranking__legend-item peer-ranking__legend-item--median">
                        Group median
                    </span>
                </div>
            </div>

            <div
                className="peer-ranking__chart"
                style={
                    {
                        "--peer-ranking-value-width": `${valueColumnWidth}ch`,
                    } as React.CSSProperties
                }
            >
                <ol
                    className="peer-ranking__rows"
                    aria-label={`${title}: ranking among ${option.description}`}
                >
                    {visibleRows.map((visibleRow) => {
                        if (visibleRow.type === "gap")
                            return (
                                <li
                                    key={`gap-${visibleRow.count}`}
                                    className="peer-ranking__gap"
                                >
                                    <span aria-hidden="true">⋯</span>
                                    <span className="sr-only">
                                        {visibleRow.count} countries not shown
                                    </span>
                                </li>
                            )
                        const { row, rank } = visibleRow.rankedRow
                        const isEntity = row.code === entityCode
                        return (
                            <li
                                key={row.code}
                                className={cx("peer-ranking__row", {
                                    "peer-ranking__row--current": isEntity,
                                })}
                            >
                                <span className="peer-ranking__rank">
                                    {rank}
                                    <span className="sr-only">.</span>
                                </span>
                                <span
                                    className="peer-ranking__name"
                                    title={getEntityName(row.code)}
                                >
                                    {getEntityName(row.code)}
                                </span>
                                <span
                                    className="peer-ranking__plot"
                                    aria-hidden="true"
                                >
                                    {groupMedian !== undefined && (
                                        <span
                                            className="peer-ranking__median"
                                            style={{
                                                left: position(groupMedian),
                                            }}
                                        />
                                    )}
                                    <span
                                        className="peer-ranking__dot"
                                        style={{ left: position(row.value) }}
                                    />
                                </span>
                                <span
                                    className="peer-ranking__value"
                                    title={formatRow(row.value)}
                                >
                                    {formatRow(row.value)}
                                </span>
                            </li>
                        )
                    })}
                </ol>
                <div className="peer-ranking__axis" aria-hidden="true">
                    <span className="peer-ranking__axis-ticks">
                        {axis.ticks.map((tick) => (
                            <span
                                key={tick.value}
                                className="peer-ranking__axis-tick"
                                style={{ left: position(tick.value) }}
                            >
                                {tick.label}
                            </span>
                        ))}
                    </span>
                    {axisUnit && (
                        <span className="peer-ranking__axis-unit">
                            {axisUnit}
                        </span>
                    )}
                </div>
                {isCollapsible && (
                    <button
                        type="button"
                        className="peer-ranking__expand"
                        aria-expanded={isExpanded}
                        onClick={() => setIsExpanded(!isExpanded)}
                    >
                        {isExpanded
                            ? "Show fewer countries"
                            : `Show all ${rankedRows.length} countries`}
                    </button>
                )}
            </div>

            <footer className="peer-ranking__footer">
                <p className="peer-ranking__source">
                    <strong>Data source:</strong> {ranking.source}
                </p>
                <div className="peer-ranking__links">
                    {learnMoreUrl && (
                        <a
                            className="peer-ranking__learn-more"
                            href={learnMoreUrl}
                        >
                            Learn more about this data
                        </a>
                    )}
                    <a className="peer-ranking__explore" href={exploreUrl}>
                        Explore this data
                        <svg
                            width="12"
                            height="12"
                            viewBox="0 0 12 12"
                            aria-hidden="true"
                            focusable="false"
                        >
                            <path d="M1.5 6h9M7 2.5 10.5 6 7 9.5" />
                        </svg>
                    </a>
                </div>
            </footer>
        </section>
    )
}

function RankStat({
    label,
    rank,
    of,
}: {
    label: string
    rank: number
    of: string
}) {
    return (
        <div className="peer-ranking__stat">
            <span className="peer-ranking__stat-label">{label}</span>
            <span className="peer-ranking__stat-value">
                <span className="peer-ranking__stat-rank">
                    {formatOrdinal(rank)}
                </span>{" "}
                <span className="peer-ranking__stat-of">{of}</span>
            </span>
        </div>
    )
}
