import * as db from "../../../db/db.js"
import {
    ChartsIndexingContext,
    DbRawExplorerView,
    ExplorerViewsTableName,
    IndexingContext,
} from "@ourworldindata/types"
import { dimensionsToViewId } from "@ourworldindata/utils"
import { getChartRedirectSlugsByChartId } from "./charts.js"
import { getAnalyticsChartViews } from "./pageviews.js"
import {
    getMultiDimRedirects,
    MultiDimRedirect,
} from "../../../db/model/MultiDimRedirects.js"
import { ExplorerAdminServer } from "../../../explorerAdminServer/ExplorerAdminServer.js"

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
 * A redirect with a resolved key for looking up its source's views_7d in the
 * analytics_chart_views map. For grapher sources the key is just the slug;
 * for explorer sources it's the explorer's default view's chartConfigId.
 * Undefined means the source can't be resolved (e.g. explorer was deleted or
 * its default view failed to extract) — treated as "no signal", not an error.
 */
export type MultiDimRedirectWithLookupKey = MultiDimRedirect & {
    lookupKey: string | undefined
}

/**
 * For each explorer slug, resolves the chartConfigId of its default view
 * (the first row of the decision matrix). Used to look up the explorer's
 * default-view pageviews in analytics_chart_views, which is keyed by
 * chartConfigId rather than explorer slug.
 */
async function getExplorerDefaultViewConfigIds(
    knex: db.KnexReadonlyTransaction,
    explorerSlugs: string[]
): Promise<Map<string, string>> {
    const result = new Map<string, string>()
    if (explorerSlugs.length === 0) return result

    const explorerAdminServer = new ExplorerAdminServer()
    const explorerSlugByViewKey = new Map<string, string>()
    for (const slug of explorerSlugs) {
        try {
            const program = await explorerAdminServer.getExplorerFromSlug(
                knex,
                slug
            )
            const firstChoice =
                program.decisionMatrix.allDecisionsAsQueryParams()[0]
            if (!firstChoice) continue
            const viewId = dimensionsToViewId(firstChoice)
            explorerSlugByViewKey.set(`${slug}:${viewId}`, slug)
        } catch {
            // Explorer may have been deleted; skip silently — caller treats
            // missing entries as "no signal".
        }
    }
    if (explorerSlugByViewKey.size === 0) return result

    const rows = await knex<
        Pick<DbRawExplorerView, "explorerSlug" | "viewId" | "chartConfigId">
    >(ExplorerViewsTableName)
        .select("explorerSlug", "viewId", "chartConfigId")
        .whereIn("explorerSlug", [...new Set(explorerSlugs)])
        .whereNotNull("chartConfigId")

    for (const row of rows) {
        const slug = explorerSlugByViewKey.get(
            `${row.explorerSlug}:${row.viewId}`
        )
        if (slug && row.chartConfigId) result.set(slug, row.chartConfigId)
    }
    return result
}

/**
 * Inverts the grapher/explorer→multi-dim redirect map into a lookup keyed by the
 * multi-dim target slug, so each mdim can find the sources that now redirect into
 * it. Each redirect is enriched with a resolved analytics_chart_views lookup
 * key (see MultiDimRedirectWithLookupKey).
 */
async function getMultiDimRedirectsByMultiDimSlug(
    knex: db.KnexReadonlyTransaction
): Promise<Map<string, MultiDimRedirectWithLookupKey[]>> {
    const [grapherTargets, explorerTargets] = await Promise.all([
        getMultiDimRedirects(knex, undefined, "/grapher/"),
        getMultiDimRedirects(knex, undefined, "/explorers/"),
    ])

    const explorerSourceSlugs = [...explorerTargets.keys()]
    const explorerDefaultViewConfigIds = await getExplorerDefaultViewConfigIds(
        knex,
        explorerSourceSlugs
    )

    const result = new Map<string, MultiDimRedirectWithLookupKey[]>()
    for (const [, redirect] of grapherTargets) {
        const enriched: MultiDimRedirectWithLookupKey = {
            ...redirect,
            lookupKey: redirect.sourceSlug,
        }
        const existing = result.get(redirect.targetSlug)
        if (existing) existing.push(enriched)
        else result.set(redirect.targetSlug, [enriched])
    }
    for (const [, redirect] of explorerTargets) {
        const enriched: MultiDimRedirectWithLookupKey = {
            ...redirect,
            lookupKey: explorerDefaultViewConfigIds.get(redirect.sourceSlug),
        }
        const existing = result.get(redirect.targetSlug)
        if (existing) existing.push(enriched)
        else result.set(redirect.targetSlug, [enriched])
    }
    return result
}

export type MultiDimIndexingContext = IndexingContext & {
    /**
     * Redirect sources (grapher or explorer slugs) grouped by the target mdim's
     * slug. Used to attribute a pre-redirect chart's views_7d to the mdim view
     * it now redirects to, so the search score doesn't lose that signal during
     * the redirect's first week.
     */
    redirectsByMultiDimSlug: Map<string, MultiDimRedirectWithLookupKey[]>
}

/**
 * Creates an IndexingContext for multi-dim views.
 * If a base context is provided, uses it; otherwise fetches everything.
 */
export async function createMultiDimIndexingContext(
    knex: db.KnexReadonlyTransaction,
    baseContext?: IndexingContext
): Promise<MultiDimIndexingContext> {
    const [base, redirectsByMultiDimSlug] = await Promise.all([
        baseContext ?? createBaseIndexingContext(knex),
        getMultiDimRedirectsByMultiDimSlug(knex),
    ])

    return { ...base, redirectsByMultiDimSlug }
}
