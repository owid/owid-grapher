import cx from "clsx"
import {
    EnrichedBlockRankingCards,
    EnrichedRankingCard,
    EntityCode,
    LinkedRanking,
} from "@ourworldindata/types"
import {
    computeRankSummary,
    formatOrdinal,
    formatYear,
    getEntityCodeFromChartUrl,
} from "@ourworldindata/utils"
import {
    useBlockRankings,
    useLinkedChart,
    useShouldRankingBlockRender,
} from "../utils.js"
import { RankingSparkline } from "./RankingSparkline.js"
import {
    formatRankChange,
    formatRankingValueParts,
    formatRankOf,
    getComparableWorldSeries,
    getGridColumns,
    getRankingUnit,
    getTopicColorKey,
} from "./rankingUtils.js"

/**
 * "At a glance" grid of rank cards: one card per indicator with the
 * entity's value, its rank among all countries, its position between the
 * lowest and highest value, and how its rank changed. With `sparklines`,
 * cards are compact key-indicator tiles with an entity-vs-World sparkline.
 */
export function RankingCards({
    block,
    className,
}: {
    block: EnrichedBlockRankingCards
    className?: string
}) {
    const rankings = useBlockRankings(block)
    const blockEntityCode = block.cards
        .map((card) => getEntityCodeFromChartUrl(card.url))
        .find((code) => code !== undefined)
    const shouldRender = useShouldRankingBlockRender(block, blockEntityCode)
    if (!shouldRender) return null

    return (
        <section
            className={cx(
                "ranking-cards",
                { "ranking-cards--sparklines": block.sparklines },
                className
            )}
        >
            {(block.title || block.subtitle) && (
                <header className="ranking-cards__header">
                    {block.title && (
                        <h2 className="ranking-cards__title">{block.title}</h2>
                    )}
                    {block.subtitle && (
                        <p className="ranking-cards__subtitle">
                            {block.subtitle}
                        </p>
                    )}
                </header>
            )}
            <ul
                className={cx(
                    "ranking-cards__grid",
                    `ranking-cards__grid--columns-${getGridColumns(
                        block.cards.length,
                        block.sparklines ? 4 : 3
                    )}`
                )}
            >
                {block.cards.map((card, index) => {
                    const ranking = rankings[index]?.ranking
                    const entityCode =
                        getEntityCodeFromChartUrl(card.url) ?? blockEntityCode
                    if (!ranking || !entityCode) return null
                    return (
                        <RankingCard
                            key={`${card.url}-${index}`}
                            card={card}
                            ranking={ranking}
                            entityCode={entityCode}
                            showSparkline={block.sparklines}
                        />
                    )
                })}
            </ul>
        </section>
    )
}

function RankingCard({
    card,
    ranking,
    entityCode,
    showSparkline,
}: {
    card: EnrichedRankingCard
    ranking: LinkedRanking
    entityCode: EntityCode
    showSparkline: boolean
}) {
    const { linkedChart } = useLinkedChart(card.url)
    const summary = computeRankSummary(ranking, entityCode, card.sort)
    if (!summary) return null

    const title = card.title ?? ranking.title
    const topicColorKey = getTopicColorKey(card.topic)
    // Long units (e.g. "deaths per 100,000 live births") wrap below the number
    const { number, unit } = formatRankingValueParts(
        summary.row.value,
        getRankingUnit(ranking)
    )
    const formatRankingTime = (rankingTime: number): string =>
        rankingTime === ranking.time
            ? ranking.formattedTime
            : formatYear(rankingTime)
    const time = formatRankingTime(summary.row.time)
    const rankOf = formatRankOf(
        formatOrdinal(summary.rank),
        summary.total,
        card.sort
    )
    const percent = Math.round(summary.percentile * 1000) / 10

    return (
        <li
            className={cx(
                "ranking-card",
                topicColorKey && `ranking-card--topic-${topicColorKey}`
            )}
        >
            <a
                className="ranking-card__link"
                href={linkedChart?.resolvedUrl ?? card.url}
            >
                {card.topic && (
                    <span className="ranking-card__topic">{card.topic}</span>
                )}
                <h3 className="ranking-card__title">
                    {title}
                    <span className="ranking-card__time">
                        <span className="sr-only">, </span>
                        {time}
                    </span>
                </h3>
                <div className="ranking-card__figures">
                    <p className="ranking-card__value">
                        <span className="ranking-card__number">{number}</span>
                        {unit && (
                            <span className="ranking-card__unit">{unit}</span>
                        )}
                    </p>
                    {!showSparkline && (
                        <span className="ranking-card__rank-pill">
                            <span className="sr-only">Ranked </span>
                            {rankOf}
                            <span className="sr-only"> countries</span>
                        </span>
                    )}
                </div>
                {showSparkline ? (
                    <>
                        {ranking.sparkline && (
                            <RankingSparkline
                                sparkline={ranking.sparkline}
                                formatTime={formatRankingTime}
                            />
                        )}
                        <div className="ranking-card__legend">
                            <span>Rank {rankOf}</span>
                            {ranking.sparkline &&
                                getComparableWorldSeries(ranking.sparkline) && (
                                <span
                                    className="ranking-card__legend-world"
                                    aria-hidden="true"
                                >
                                    World
                                </span>
                            )}
                        </div>
                    </>
                ) : (
                    <div
                        className={cx(
                            "ranking-card__percentile",
                            `ranking-card__percentile--${card.sort}-is-better`
                        )}
                    >
                        <span className="sr-only">
                            {card.sort === "lowest"
                                ? "Lower is better."
                                : "Higher is better."}
                        </span>
                        <div
                            className="ranking-card__percentile-track"
                            aria-hidden="true"
                        >
                            <div
                                className="ranking-card__percentile-marker"
                                style={{ left: `${percent}%` }}
                            />
                        </div>
                        <div
                            className="ranking-card__percentile-labels"
                            aria-hidden="true"
                        >
                            {(["lowest", "highest"] as const).map((end) => (
                                <span
                                    key={end}
                                    className={cx(
                                        "ranking-card__percentile-label",
                                        end === card.sort &&
                                            "ranking-card__percentile-label--better"
                                    )}
                                >
                                    {end === "lowest" ? "Lowest" : "Highest"}
                                    {end === card.sort && (
                                        <span className="ranking-card__percentile-better">
                                            {" "}
                                            · better
                                        </span>
                                    )}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
                <div className="ranking-card__footer">
                    {!showSparkline &&
                        summary.rankChange !== undefined &&
                        ranking.prevTime !== undefined && (
                            <span className="ranking-card__change">
                                <RankChangeArrow change={summary.rankChange} />
                                {formatRankChange(
                                    summary.rankChange,
                                    ranking.prevTime
                                )}
                            </span>
                        )}
                    <span className="ranking-card__source">
                        {showSparkline && "Data source: "}
                        {ranking.source}
                    </span>
                </div>
            </a>
        </li>
    )
}

function RankChangeArrow({ change }: { change: number }) {
    if (change === 0) return null
    return (
        <svg
            className="ranking-card__change-arrow"
            width="12"
            height="12"
            viewBox="0 0 12 12"
            aria-hidden="true"
            focusable="false"
        >
            <path
                d={
                    change > 0
                        ? "M6 10.5v-9M2.5 5 6 1.5 9.5 5"
                        : "M6 1.5v9M2.5 7 6 10.5 9.5 7"
                }
            />
        </svg>
    )
}
