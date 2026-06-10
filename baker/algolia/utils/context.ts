import * as db from "../../../db/db.js"
import {
    ChartsIndexingContext,
    DbPlainMultiDimXChartConfig,
    ExplorerIndexingContext,
    IndexingContext,
    MultiDimXChartConfigsTableName,
} from "@ourworldindata/types"
import { getChartRedirectSlugsByChartId } from "./charts.js"
import {
    getChartViewsMap,
    getMaxChartViewsFromMultiDimPredecessors,
} from "./pageviews.js"
import { getAnalyticsPageviewsByUrlObj } from "../../../db/model/Pageview.js"

/**
 * Creates a base IndexingContext containing the shared enrichment data.
 */
export async function createBaseIndexingContext(
    knex: db.KnexReadonlyTransaction
): Promise<IndexingContext> {
    const [topicHierarchies, chartViewsMap, pageviews] = await Promise.all([
        db.getTopicHierarchiesByChildName(knex),
        getChartViewsMap(knex),
        getAnalyticsPageviewsByUrlObj(knex),
    ])

    return {
        topicHierarchies,
        chartViewsMap,
        pageviews,
    }
}

/**
 * Creates an IndexingContext with chart-specific enrichment data.
 * If a base context is provided, extends it; otherwise fetches everything.
 */
export async function createChartsIndexingContext(
    knex: db.KnexReadonlyTransaction,
    chartIds?: number[],
    baseContext?: IndexingContext
): Promise<ChartsIndexingContext> {
    const [base, redirectsByChartId] = await Promise.all([
        baseContext ?? createBaseIndexingContext(knex),
        getChartRedirectSlugsByChartId(knex, chartIds),
    ])

    return {
        ...base,
        redirectsByChartId,
    }
}

/**
 * Creates an IndexingContext for explorers.
 * If a base context is provided, uses it; otherwise fetches everything.
 */
export async function createExplorersIndexingContext(
    knex: db.KnexReadonlyTransaction,
    baseContext?: IndexingContext
): Promise<ExplorerIndexingContext> {
    const [base] = await Promise.all([
        baseContext ?? createBaseIndexingContext(knex),
    ])

    return base
}

export type MultiDimIndexingContext = IndexingContext & {
    multiDimXChartConfigIdMap: Map<string, number>
    predecessorMaxChartViewsByMultiDimViewConfigId: Map<string, number>
}

async function getMultiDimXChartConfigIdMap(trx: db.KnexReadonlyTransaction) {
    const rows = await trx<DbPlainMultiDimXChartConfig>(
        MultiDimXChartConfigsTableName
    ).select("id", "multiDimId", "viewId")
    return new Map(
        rows.map((row) => [`${row.multiDimId}-${row.viewId}`, row.id])
    )
}

/**
 * Creates an IndexingContext for multi-dim views.
 * If a base context is provided, uses it; otherwise fetches everything.
 */
export async function createMultiDimIndexingContext(
    knex: db.KnexReadonlyTransaction,
    baseContext?: IndexingContext
): Promise<MultiDimIndexingContext> {
    const [
        base,
        multiDimXChartConfigIdMap,
        predecessorMaxChartViewsByMultiDimViewConfigId,
    ] = await Promise.all([
        baseContext ?? createBaseIndexingContext(knex),
        getMultiDimXChartConfigIdMap(knex),
        getMaxChartViewsFromMultiDimPredecessors(knex),
    ])

    return {
        ...base,
        multiDimXChartConfigIdMap,
        predecessorMaxChartViewsByMultiDimViewConfigId,
    }
}
