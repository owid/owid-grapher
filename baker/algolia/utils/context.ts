import * as db from "../../../db/db.js"
import {
    ChartsIndexingContext,
    IndexingContext,
    MdimIndexingContext,
    MdimRedirectSource,
} from "@ourworldindata/types"
import { getChartRedirectSlugsByChartId } from "./charts.js"
import { getAnalyticsChartViews } from "./pageviews.js"
import { getMultiDimRedirectTargets } from "../../../db/model/MultiDimRedirects.js"

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
 * Inverts the grapher→mdim redirect map into a lookup keyed by the mdim target
 * slug, so each mdim can find the grapher slugs that now redirect into it.
 * Skipping explorers, because multi_dims_redirects doesn't have query params:
 * We'd only be able to redirect /explorers/base to /graphers/base
 */
async function getMdimRedirectsByMdimSlug(
    knex: db.KnexReadonlyTransaction
): Promise<Map<string, MdimRedirectSource[]>> {
    const targets = await getMultiDimRedirectTargets(
        knex,
        undefined,
        "/grapher/"
    )
    const result = new Map<string, MdimRedirectSource[]>()
    for (const [sourceSlug, target] of targets) {
        const sources = result.get(target.targetSlug)
        const entry: MdimRedirectSource = {
            sourceSlug,
            queryStr: target.queryStr,
        }
        if (sources) sources.push(entry)
        else result.set(target.targetSlug, [entry])
    }
    return result
}

/**
 * Creates an IndexingContext for multi-dim views.
 * If a base context is provided, uses it; otherwise fetches everything.
 */
export async function createMdimIndexingContext(
    knex: db.KnexReadonlyTransaction,
    baseContext?: IndexingContext
): Promise<MdimIndexingContext> {
    const [base, redirectsByMdimSlug] = await Promise.all([
        baseContext ?? createBaseIndexingContext(knex),
        getMdimRedirectsByMdimSlug(knex),
    ])

    return { ...base, redirectsByMdimSlug }
}
