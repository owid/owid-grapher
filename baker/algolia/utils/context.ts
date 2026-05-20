import * as db from "../../../db/db.js"
import { ChartsIndexingContext, IndexingContext } from "@ourworldindata/types"
import { getChartRedirectSlugsByChartId } from "./charts.js"
import { getAnalyticsChartViews } from "./pageviews.js"
import {
    getMultiDimRedirectTargets,
    MultiDimRedirectSource,
} from "../../../db/model/MultiDimRedirects.js"

/**
 * Creates a base IndexingContext containing the shared enrichment data.
 */
export async function createBaseIndexingContext(
    knex: db.KnexReadonlyTransaction
): Promise<IndexingContext> {
    const [chartViews, topicHierarchies] = await Promise.all([
        getAnalyticsChartViews(knex),
        db.getTopicHierarchiesByChildName(knex),
    ])

    return { chartViews, topicHierarchies }
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
): Promise<Map<string, MultiDimRedirectSource[]>> {
    const targets = await getMultiDimRedirectTargets(
        knex,
        undefined,
        "/grapher/"
    )
    const result = new Map<string, MultiDimRedirectSource[]>()
    for (const [sourceSlug, target] of targets) {
        const sources = result.get(target.targetSlug)
        const entry: MultiDimRedirectSource = {
            sourceSlug,
            queryStr: target.queryStr,
        }
        if (sources) sources.push(entry)
        else result.set(target.targetSlug, [entry])
    }
    return result
}

export type MultiDimIndexingContext = IndexingContext & {
    /**
     * Grapher-slug redirect sources grouped by the target mdim's slug.
     * Used to attribute a pre-redirect grapher chart's views_7d to the mdim view
     * it now redirects to, so the search score doesn't lose that signal during
     * the redirect's first week.
     */
    redirectsByMdimSlug: Map<string, MultiDimRedirectSource[]>
}

/**
 * Creates an IndexingContext for multi-dim views.
 * If a base context is provided, uses it; otherwise fetches everything.
 */
export async function createMultiDimIndexingContext(
    knex: db.KnexReadonlyTransaction,
    baseContext?: IndexingContext
): Promise<MultiDimIndexingContext> {
    const [base, redirectsByMdimSlug] = await Promise.all([
        baseContext ?? createBaseIndexingContext(knex),
        getMdimRedirectsByMdimSlug(knex),
    ])

    return { ...base, redirectsByMdimSlug }
}
