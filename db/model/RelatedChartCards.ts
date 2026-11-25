import { RelatedChart, RelatedChartSource } from "@ourworldindata/types"
import * as db from "../db.js"
import {
    ChartTopicTagIds,
    getChartsByAggregateCoviewScore,
    getRelatedChartsForChart,
    getTopicTagIdsForChart,
} from "./Chart.js"

const RELATED_CHART_CARD_COUNT = 5

export interface RelatedChartStage {
    source: RelatedChartSource
    fetch: (limit: number, excludeChartIds: number[]) => Promise<RelatedChart[]>
}

/** Runs each stage only while slots remain, asking only for what's missing */
export async function pickRelatedChartCards(
    chartId: number,
    stages: RelatedChartStage[],
    count: number = RELATED_CHART_CARD_COUNT
): Promise<RelatedChart[]> {
    const picked: RelatedChart[] = []
    const seen = new Set<number>([chartId])
    for (const stage of stages) {
        const missing = count - picked.length
        if (missing <= 0) break
        const candidates = await stage.fetch(missing, [...seen])
        for (const chart of candidates) {
            if (picked.length >= count) break
            if (seen.has(chart.chartId)) continue
            seen.add(chart.chartId)
            picked.push({ ...chart, source: stage.source })
        }
    }
    return picked
}

/**
 * Coviews, topped up from the primary topic, the other topics, their areas,
 * then site-wide, each ranked by aggregate coview score
 */
export async function getRelatedChartCards(
    knex: db.KnexReadonlyTransaction,
    chartId: number,
    topicTagNames: string[]
): Promise<RelatedChart[]> {
    let topicTagIds: Promise<ChartTopicTagIds> | undefined
    const getTopicTagIds = (): Promise<ChartTopicTagIds> =>
        (topicTagIds ??= getTopicTagIdsForChart(knex, chartId, topicTagNames))

    const byScore =
        (tagIds: () => Promise<number[] | undefined>) =>
        async (
            limit: number,
            excludeChartIds: number[]
        ): Promise<RelatedChart[]> =>
            getChartsByAggregateCoviewScore(knex, {
                tagIds: await tagIds(),
                excludeChartIds,
                limit,
            })

    return pickRelatedChartCards(chartId, [
        {
            source: "coviews",
            fetch: (limit) => getRelatedChartsForChart(knex, chartId, limit),
        },
        {
            source: "primary-topic",
            fetch: byScore(async () => {
                const { primary } = await getTopicTagIds()
                return primary !== undefined ? [primary] : []
            }),
        },
        {
            source: "other-topics",
            fetch: byScore(async () => (await getTopicTagIds()).others),
        },
        {
            source: "topic-area",
            fetch: byScore(async () => {
                const { primary, others } = await getTopicTagIds()
                return db.getTopicTagIdsInSameAreas(
                    knex,
                    primary !== undefined ? [primary, ...others] : others
                )
            }),
        },
        {
            source: "site-wide",
            fetch: byScore(async () => undefined),
        },
    ])
}
