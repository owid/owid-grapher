import { RelatedChart, RelatedChartSource } from "@ourworldindata/types"
import * as db from "../db.js"
import {
    getChartsByAggregateCoviewScore,
    getRelatedChartsForChart,
    getTopicTagIdsForChart,
    getTopicTagIdsInSameAreas,
} from "./Chart.js"

/** Number of related-chart cards a data page shows */
export const RELATED_CHART_CARD_COUNT = 5

/** One step of the selection: where its charts come from, and how to fetch them */
export interface RelatedChartStage {
    source: RelatedChartSource
    /** Fetch up to `limit` candidates, none of which are in `excludeChartIds` */
    fetch: (limit: number, excludeChartIds: number[]) => Promise<RelatedChart[]>
}

/**
 * Fill the related-chart cards stage by stage: each stage only runs if earlier
 * ones left slots empty, and is asked only for what is still missing. Charts are
 * never repeated and the page's own chart is never shown. Each card records the
 * stage that picked it.
 */
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
 * The related-chart cards for a data page. Coview recommendations come first.
 * Pages with fewer than five (new pages, and the long tail) are topped up from
 * the page's primary topic, then its other topics, then the topic areas those
 * topics belong to, then site-wide. Fallback candidates are ranked by their
 * aggregate coview score, so the most-explored charts in a topic come first.
 */
export async function getRelatedChartCards(
    knex: db.KnexReadonlyTransaction,
    chartId: number,
    topicTagNames: string[]
): Promise<RelatedChart[]> {
    // Topic tag ids are only needed if coviews fall short, so resolve them lazily
    let topicTagIds: Promise<number[]> | undefined
    const getTopicTagIds = (): Promise<number[]> =>
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
            fetch: byScore(async () => (await getTopicTagIds()).slice(0, 1)),
        },
        {
            source: "other-topics",
            fetch: byScore(async () => (await getTopicTagIds()).slice(1)),
        },
        {
            source: "topic-area",
            fetch: byScore(async () =>
                getTopicTagIdsInSameAreas(knex, await getTopicTagIds())
            ),
        },
        {
            source: "site-wide",
            fetch: byScore(async () => undefined),
        },
    ])
}
