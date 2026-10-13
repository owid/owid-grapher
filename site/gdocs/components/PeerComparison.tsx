import { Fragment, useRef, useState } from "react"
import Tippy from "@tippyjs/react"
import cx from "clsx"
import {
    EnrichedBlockPeerComparison,
    EnrichedPeerComparisonIndicator,
    EntityCode,
    LinkedRanking,
    LinkedRankingRow,
} from "@ourworldindata/types"
import {
    defaultPeerGroupsForEntity,
    formatYear,
    getEntityCodeFromChartUrl,
    WORLD_PEER_GROUP_NAME,
} from "@ourworldindata/utils"
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
    makePeerGroupOption,
    mean,
    PeerGroupOption,
    scaleToUnit,
} from "./rankingUtils.js"
import { POPULATION_BY_ENTITY_CODE } from "./populations.data.js"

// The rank direction doesn't matter here, we only need the group's rows
const SORT = "highest"

/** Peer dot radii (px) for the smallest and largest populations */
const PEER_RADIUS_RANGE: [number, number] = [2.5, 6.5]
/** Peer dot opacities for the smallest and largest populations */
const PEER_OPACITY_RANGE: [number, number] = [0.45, 0.9]
/** Populations at which the dot size bottoms and tops out (log scale) */
const PEER_POPULATION_RANGE: [number, number] = [1e5, 1.5e9]

/** Larger, more opaque dots for more populous countries */
function getPeerDotStyle(code: string): { radius: number; opacity: number } {
    const population = POPULATION_BY_ENTITY_CODE[code]
    // Midpoint for entities without population data
    const t =
        population === undefined
            ? 0.5
            : scaleToUnit(Math.log10(population), [
                  Math.log10(PEER_POPULATION_RANGE[0]),
                  Math.log10(PEER_POPULATION_RANGE[1]),
              ])
    const lerp = ([min, max]: [number, number]): number => min + t * (max - min)
    return {
        radius: lerp(PEER_RADIUS_RANGE),
        opacity: lerp(PEER_OPACITY_RANGE),
    }
}

/**
 * How an entity compares with a peer group across several indicators: one
 * strip per indicator with the group's countries as dots, the group
 * average as a tick, and the entity highlighted.
 */
export function PeerComparison({
    block,
    className,
}: {
    block: EnrichedBlockPeerComparison
    className?: string
}) {
    const rankings = useBlockRankings(block)
    const entityCode = block.indicators
        .map((indicator) => getEntityCodeFromChartUrl(indicator.url))
        .find((code) => code !== undefined)
    const shouldRender = useShouldRankingBlockRender(block, entityCode)
    const [selectedGroupName, setSelectedGroupName] = useState<string>()

    if (!shouldRender || !entityCode) return null

    const groupNames =
        block.groups.length > 0
            ? block.groups
            : defaultPeerGroupsForEntity(entityCode)
    const options: PeerGroupOption[] = groupNames
        .filter((name) =>
            rankings.some(
                ({ ranking }) =>
                    ranking &&
                    computePeerGroupSummary(ranking, entityCode, SORT, name)
            )
        )
        .map((name) => makePeerGroupOption(name, entityCode))
    if (options.length === 0)
        options.push(makePeerGroupOption(WORLD_PEER_GROUP_NAME, entityCode))
    const selected =
        options.find((option) => option.name === selectedGroupName) ??
        options[0]

    const entityName = getEntityName(entityCode)
    const title =
        block.title ?? `How ${getArticulatedEntityName(entityCode)} compares`

    return (
        <section className={cx("peer-comparison", className)}>
            <header className="peer-comparison__header">
                <h2 className="peer-comparison__title">{title}</h2>
                <p className="peer-comparison__subtitle">
                    Each dot is a country among {selected.description}, based on
                    the latest available data.
                </p>
            </header>
            <PeerGroupToggle
                options={options}
                selected={selected.name}
                onChange={setSelectedGroupName}
                label="Compare against"
                variant="pills"
            />
            <ul className="peer-comparison__rows">
                {block.indicators.map((indicator, index) => {
                    const ranking = rankings[index]?.ranking
                    if (!ranking) return null
                    return (
                        <PeerComparisonRow
                            key={`${indicator.url}-${index}`}
                            indicator={indicator}
                            ranking={ranking}
                            entityCode={
                                getEntityCodeFromChartUrl(indicator.url) ??
                                entityCode
                            }
                            group={selected}
                        />
                    )
                })}
            </ul>
            <div className="peer-comparison__legend" aria-hidden="true">
                <span className="peer-comparison__legend-item peer-comparison__legend-item--entity">
                    {entityName}
                </span>
                <span className="peer-comparison__legend-item peer-comparison__legend-item--peers">
                    {selected.name}
                </span>
                <span className="peer-comparison__legend-item peer-comparison__legend-item--average">
                    Group average
                </span>
            </div>
        </section>
    )
}

function PeerComparisonRow({
    indicator,
    ranking,
    entityCode,
    group,
}: {
    indicator: EnrichedPeerComparisonIndicator
    ranking: LinkedRanking
    entityCode: EntityCode
    group: PeerGroupOption
}) {
    const { linkedChart } = useLinkedChart(indicator.url)
    const result = computePeerGroupSummary(
        ranking,
        entityCode,
        SORT,
        group.name
    )
    if (!result) return null

    const { summary, groupCodes } = result
    const groupRows = ranking.rows.filter((row) => groupCodes.has(row.code))
    const values = groupRows.map((row) => row.value)
    const domain: [number, number] = [Math.min(...values), Math.max(...values)]
    const average = mean(values)
    const x = (value: number): number => scaleToUnit(value, domain)

    const label = indicator.title ?? ranking.title
    const minRow = groupRows.find((row) => row.value === domain[0])
    const maxRow = groupRows.find((row) => row.value === domain[1])
    // Tooltips have room for the full unit, the value column only for a
    // short one
    const unit = getRankingUnit(ranking)
    const format = (value: number): string =>
        formatRankingValue(value, { unit })
    const formatScale = (value: number): string =>
        formatRankingValue(value, { unit: getInlineUnit(unit) })
    const formattedAverage = average !== undefined ? format(average) : undefined
    const ariaLabel = [
        `${getEntityName(entityCode)}: ${format(summary.row.value)}`,
        formattedAverage &&
            `average of ${group.description}: ${formattedAverage}`,
        minRow &&
            maxRow &&
            `range from ${format(minRow.value)} to ${format(maxRow.value)}`,
    ]
        .filter(Boolean)
        .join("; ")

    return (
        <li className="peer-comparison__row">
            <a
                className="peer-comparison__label"
                href={linkedChart?.resolvedUrl ?? indicator.url}
            >
                {label}
            </a>
            <PeerComparisonStrip
                points={[
                    ...groupRows
                        .filter((row) => row.code !== entityCode)
                        .map((row) =>
                            toStripPoint(row, ranking, "peer", format)
                        ),
                    ...(average !== undefined && formattedAverage
                        ? [
                              {
                                  key: "average",
                                  kind: "average" as const,
                                  value: average,
                                  label: "Group average",
                                  formattedValue: formattedAverage,
                              },
                          ]
                        : []),
                    toStripPoint(summary.row, ranking, "entity", format),
                ]}
                x={x}
                // Indicators that cross zero (e.g. growth rates) get a zero line
                showZeroLine={domain[0] < 0 && domain[1] > 0}
                scaleLabels={[formatScale(domain[0]), formatScale(domain[1])]}
                ariaLabel={ariaLabel}
            />
            <span className="peer-comparison__value">
                {formatRankingValue(summary.row.value, {
                    unit: getInlineUnit(unit),
                })}
            </span>
        </li>
    )
}

interface StripPoint {
    key: string
    kind: "peer" | "entity" | "average"
    value: number
    label: string
    formattedValue: string
    formattedTime?: string
}

function toStripPoint(
    row: LinkedRankingRow,
    ranking: LinkedRanking,
    kind: "peer" | "entity",
    format: (value: number) => string
): StripPoint {
    return {
        key: row.code,
        kind,
        value: row.value,
        label: getEntityName(row.code),
        formattedValue: format(row.value),
        formattedTime:
            row.time === ranking.time
                ? ranking.formattedTime
                : formatYear(row.time),
    }
}

const toPercent = (fraction: number): string =>
    `${(fraction * 100).toFixed(2)}%`

/**
 * Dot strip with a tooltip for the hovered (or tapped) dot. Keyboard users
 * focus the strip and move between dots with the arrow keys. One tooltip
 * instance per strip, positioned at the active dot, since a strip can have
 * ~200 dots.
 */
function PeerComparisonStrip({
    points,
    x,
    scaleLabels,
    showZeroLine,
    ariaLabel,
}: {
    points: StripPoint[]
    x: (value: number) => number
    showZeroLine: boolean
    /** The group's minimum and maximum, shown below the strip */
    scaleLabels: [string, string]
    ariaLabel: string
}) {
    const [activeKey, setActiveKey] = useState<string>()
    const stripRef = useRef<HTMLDivElement>(null)
    const dotRefs = useRef(new Map<string, SVGElement>())
    const active = points.find((point) => point.key === activeKey)

    // Keyboard order: by value, so that arrow keys move along the strip
    const sortedPoints = [...points].sort((a, b) => a.value - b.value)
    const moveActive = (step: number): void => {
        const index = sortedPoints.findIndex((p) => p.key === activeKey)
        const next =
            sortedPoints[
                Math.min(sortedPoints.length - 1, Math.max(0, index + step))
            ]
        if (next) setActiveKey(next.key)
    }
    const onKeyDown = (event: React.KeyboardEvent): void => {
        if (event.key === "ArrowRight" || event.key === "ArrowUp") {
            event.preventDefault()
            moveActive(1)
        } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
            event.preventDefault()
            moveActive(-1)
        } else if (event.key === "Escape") {
            setActiveKey(undefined)
        }
    }

    const peers = points.filter((point) => point.kind === "peer")
    const average = points.find((point) => point.kind === "average")
    const entity = points.find((point) => point.kind === "entity")

    const setDotRef =
        (key: string) =>
        (element: SVGElement | null): void => {
            if (element) dotRefs.current.set(key, element)
            else dotRefs.current.delete(key)
        }
    const hitArea = (point: StripPoint): React.ReactElement => (
        <circle
            className="peer-comparison__hit-area"
            cx={toPercent(x(point.value))}
            cy="50%"
            r={point.kind === "entity" ? 10 : 7}
            onPointerEnter={() => setActiveKey(point.key)}
            onClick={() => setActiveKey(point.key)}
        />
    )

    return (
        <>
            <Tippy
                // A reference rather than a child, which @tippyjs/react would
                // access via the `element.ref` removed in React 19
                reference={stripRef as React.RefObject<Element>}
                content={
                    active && (
                        <div className="peer-comparison__tooltip">
                            <span className="peer-comparison__tooltip-label">
                                {active.label}
                            </span>
                            <span>
                                {active.formattedValue}
                                {active.formattedTime && (
                                    <span className="peer-comparison__tooltip-time">
                                        {" "}
                                        in {active.formattedTime}
                                    </span>
                                )}
                            </span>
                        </div>
                    )
                }
                visible={active !== undefined}
                getReferenceClientRect={() =>
                    (activeKey
                        ? dotRefs.current.get(activeKey)
                        : undefined
                    )?.getBoundingClientRect() ?? new DOMRect()
                }
                placement="top"
                theme="light"
                arrow={false}
                offset={[0, 6]}
            />
            <div
                ref={stripRef}
                className="peer-comparison__strip"
                onPointerLeave={() => setActiveKey(undefined)}
            >
                <svg
                    className="peer-comparison__strip-svg"
                    role="img"
                    aria-label={ariaLabel}
                    tabIndex={0}
                    onFocus={() => setActiveKey(entity?.key)}
                    onBlur={() => setActiveKey(undefined)}
                    onKeyDown={onKeyDown}
                >
                    <line
                        className="peer-comparison__strip-axis"
                        x1="0"
                        x2="100%"
                        y1="50%"
                        y2="50%"
                    />
                    {showZeroLine && (
                        <g className="peer-comparison__zero">
                            <line
                                x1={toPercent(x(0))}
                                x2={toPercent(x(0))}
                                y1="0"
                                y2="28"
                            />
                            <text x={toPercent(x(0))} dx="4" y="7">
                                0
                            </text>
                        </g>
                    )}
                    {peers.map((point) => {
                        const isActive = point.key === activeKey
                        const { radius, opacity } = getPeerDotStyle(point.key)
                        return (
                            <circle
                                key={point.key}
                                ref={setDotRef(point.key)}
                                className={cx("peer-comparison__peer", {
                                    "peer-comparison__peer--active": isActive,
                                })}
                                cx={toPercent(x(point.value))}
                                cy="50%"
                                r={isActive ? radius + 1 : radius}
                                style={
                                    isActive
                                        ? undefined
                                        : { fillOpacity: opacity }
                                }
                            />
                        )
                    })}
                    {peers.map((point) => (
                        <Fragment key={point.key}>{hitArea(point)}</Fragment>
                    ))}
                    {average && (
                        <g>
                            <line
                                ref={setDotRef(average.key)}
                                className={cx("peer-comparison__average", {
                                    "peer-comparison__average--active":
                                        average.key === activeKey,
                                })}
                                x1={toPercent(x(average.value))}
                                x2={toPercent(x(average.value))}
                                y1="4"
                                y2="24"
                            />
                            <line
                                className="peer-comparison__hit-area peer-comparison__hit-area--line"
                                x1={toPercent(x(average.value))}
                                x2={toPercent(x(average.value))}
                                y1="2"
                                y2="26"
                                onPointerEnter={() => setActiveKey(average.key)}
                                onClick={() => setActiveKey(average.key)}
                            />
                        </g>
                    )}
                    {/* The entity is drawn last, so that it stays on top */}
                    {entity && (
                        <g>
                            <circle
                                ref={setDotRef(entity.key)}
                                className={cx("peer-comparison__entity", {
                                    "peer-comparison__entity--active":
                                        entity.key === activeKey,
                                })}
                                cx={toPercent(x(entity.value))}
                                cy="50%"
                                r="7"
                            />
                            {hitArea(entity)}
                        </g>
                    )}
                </svg>
                <div
                    className="peer-comparison__strip-scale"
                    aria-hidden="true"
                >
                    <span>{scaleLabels[0]}</span>
                    <span>{scaleLabels[1]}</span>
                </div>
            </div>
        </>
    )
}
