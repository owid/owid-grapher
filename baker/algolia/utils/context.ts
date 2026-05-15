import * as db from "../../../db/db.js"
import { ChartsIndexingContext, IndexingContext } from "@ourworldindata/types"
import { getChartRedirectSlugsByChartId } from "./charts.js"
import { getAnalyticsChartViews } from "./pageviews.js"

/**
 * Creates a base IndexingContext containing the shared enrichment data.
 */
export async function createBaseIndexingContext(
    knex: db.KnexReadonlyTransaction
): Promise<IndexingContext> {
    const [views, topicHierarchies] = await Promise.all([
        getAnalyticsChartViews(knex),
        db.getTopicHierarchiesByChildName(knex),
    ])

    return { views, topicHierarchies }
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

    return { ...base, redirectsByChartId }
}

/**
 * Creates an IndexingContext for explorers.
 * If a base context is provided, uses it; otherwise fetches everything.
 */
export async function createExplorersIndexingContext(
    knex: db.KnexReadonlyTransaction,
    baseContext?: IndexingContext
): Promise<IndexingContext> {
    return baseContext ?? createBaseIndexingContext(knex)
}

/**
 * Creates an IndexingContext for multi-dim views.
 * If a base context is provided, uses it; otherwise fetches everything.
 */
export async function createMdimIndexingContext(
    knex: db.KnexReadonlyTransaction,
    baseContext?: IndexingContext
): Promise<IndexingContext> {
    return baseContext ?? createBaseIndexingContext(knex)
}
