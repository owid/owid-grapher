import * as _ from "lodash-es"
import { RelatedChart, RelatedChartTier } from "@ourworldindata/types"
import * as db from "../db.js"
import {
    getChartsByAggregateCoviewScore,
    getRelatedChartsForChart,
    getTopicTagIdsForChart,
} from "./Chart.js"

const RELATED_CHART_CARD_COUNT = 5

/** One way of finding related charts. Tiers are tried in order until the cards are filled. */
export interface RelatedChartTierQuery {
    tier: RelatedChartTier
    fetch: (limit: number, excludeChartIds: number[]) => Promise<RelatedChart[]>
}

/** Runs each tier only while slots remain, asking only for what's missing */
export async function pickRelatedChartCards(
    chartId: number,
    tierQueries: RelatedChartTierQuery[],
    count: number = RELATED_CHART_CARD_COUNT
): Promise<RelatedChart[]> {
    const picked: RelatedChart[] = []
    const seen = new Set<number>([chartId])
    for (const { tier, fetch } of tierQueries) {
        const missing = count - picked.length
        if (missing <= 0) break
        const candidates = await fetch(missing, [...seen])
        for (const chart of candidates) {
            if (picked.length >= count) break
            if (seen.has(chart.chartId)) continue
            seen.add(chart.chartId)
            picked.push({ ...chart, tier })
        }
    }
    return picked
}

/**
 * Coviews, topped up from the primary topic, the other topics, then site-wide,
 * each ranked by aggregate coview score
 */
export async function getRelatedChartCards(
    knex: db.KnexReadonlyTransaction,
    chartId: number,
    indicatorTopicNames: string[]
): Promise<RelatedChart[]> {
    const getTopicTagIds = _.once(() =>
        getTopicTagIdsForChart(knex, chartId, indicatorTopicNames)
    )

    const topChartsTaggedWith =
        (getTagIds: () => Promise<number[]>): RelatedChartTierQuery["fetch"] =>
        async (limit, excludeChartIds) =>
            getChartsByAggregateCoviewScore(knex, {
                tagIds: await getTagIds(),
                excludeChartIds,
                limit,
            })

    return pickRelatedChartCards(chartId, [
        {
            tier: "coviews",
            fetch: (limit) => getRelatedChartsForChart(knex, chartId, limit),
        },
        {
            tier: "primary-topic",
            fetch: topChartsTaggedWith(async () => {
                const { primary } = await getTopicTagIds()
                return primary !== undefined ? [primary] : []
            }),
        },
        {
            tier: "other-topics",
            fetch: topChartsTaggedWith(
                async () => (await getTopicTagIds()).others
            ),
        },
        {
            tier: "site-wide",
            fetch: (limit, excludeChartIds) =>
                getChartsByAggregateCoviewScore(knex, {
                    excludeChartIds,
                    limit,
                }),
        },
    ])
}
