import {
    AnalyticsChartViewsTableName,
    ChartViewsMap,
    DbPlainAnalyticsChartView,
    DbPlainMultiDimDataPage,
    DbPlainMultiDimRedirect,
    DbRawExplorerView,
    ExplorerViewsTableName,
    MultiDimDataPagesTableName,
    MultiDimRedirectsTableName,
} from "@ourworldindata/types"
import * as db from "../../../db/db.js"
import * as R from "remeda"
import { MultiDimDataPageConfig } from "@ourworldindata/utils"

/**
 * Collapses analytics rows to a single max views_7d per chart_slug. A slug can
 * appear in multiple rows (e.g. a multidim has one row per view, all sharing the
 * mdim slug), so we keep the highest count rather than an arbitrary one.
 */
function maxViewsBySlug(
    rows: Pick<DbPlainAnalyticsChartView, "chart_slug" | "views_7d">[]
): Map<string, number> {
    const map = new Map<string, number>()
    for (const row of rows) {
        const current = map.get(row.chart_slug)
        if (current === undefined || row.views_7d > current) {
            map.set(row.chart_slug, row.views_7d)
        }
    }
    return map
}

function makeChartViewsForMultiDimRedirectSources(
    chartViews: Pick<
        DbPlainAnalyticsChartView,
        "chart_slug" | "views_7d" | "type"
    >[],
    redirects: Pick<DbPlainMultiDimRedirect, "source">[]
): Map<string, number> {
    const [explorerRows, grapherAndMultiDimRows] = R.partition(
        chartViews,
        (v) => v.type === "explorer"
    )

    const viewsByNamespaceAndSlug: Record<string, Map<string, number>> = {
        explorers: maxViewsBySlug(explorerRows),
        grapher: maxViewsBySlug(grapherAndMultiDimRows),
    }

    const map = new Map<string, number>()
    for (const redirect of redirects) {
        // e.g. "/grapher/some-slug" -> ["grapher", "some-slug"]
        const [namespace, slug] = redirect.source.split("/").slice(1)
        const views = viewsByNamespaceAndSlug[namespace]?.get(slug)
        if (views !== undefined) map.set(redirect.source, views)
    }
    return map
}

// For every multi-dim target, find the max views_7d among its predecessor
// e.g. /explorers/some-slug has 100 views and points to the-uuid-of-some-multidim
// and /grapher/some-other-slug has 50 views and also points to the-uuid-of-some-multidim,
// then the map will be { "the-uuid-of-some-multidim" → 100 }
export async function getMaxChartViewsFromMultiDimPredecessors(
    trx: db.KnexReadonlyTransaction
): Promise<Map<string, number>> {
    const chartViews = await trx<DbPlainAnalyticsChartView>(
        AnalyticsChartViewsTableName
    ).select("chart_slug", "view_config_id", "type", "views_7d")
    const redirects = await trx<DbPlainMultiDimRedirect>(
        MultiDimRedirectsTableName
    ).select("source", "viewConfigId", "multiDimId")

    const viewsBySource = makeChartViewsForMultiDimRedirectSources(
        chartViews,
        redirects
    )

    // Redirects without an explicit viewConfigId target the multi-dim's default view.
    const multiDimIdsNeedingDefault = redirects
        .filter((r) => !r.viewConfigId)
        .map((r) => r.multiDimId)
    const defaultViewConfigIdByMultiDimId = new Map<number, string>()
    if (multiDimIdsNeedingDefault.length) {
        const rows = await trx<DbPlainMultiDimDataPage>(
            MultiDimDataPagesTableName
        )
            .select("id", "config")
            .whereIn("id", multiDimIdsNeedingDefault)
        for (const row of rows) {
            const id = MultiDimDataPageConfig.fromJson(
                row.config
            ).getDefaultView()?.fullConfigId
            if (id) defaultViewConfigIdByMultiDimId.set(row.id, id)
        }
    }

    // Resolve every redirect to a single target view id, then track the max
    // source views per target in one pass.
    const map = new Map<string, number>()
    for (const redirect of redirects) {
        const targetViewConfigId =
            redirect.viewConfigId ??
            defaultViewConfigIdByMultiDimId.get(redirect.multiDimId)
        if (!targetViewConfigId) continue

        const sourceViews = viewsBySource.get(redirect.source)
        if (sourceViews === undefined) continue

        const current = map.get(targetViewConfigId)
        map.set(
            targetViewConfigId,
            current === undefined ? sourceViews : Math.max(current, sourceViews)
        )
    }

    return map
}

/**
 * Fetches all rows from analytics_chart_views and builds the lookup maps in
 * ChartViewsMap in a single pass
 */
export async function getChartViewsMap(
    trx: db.KnexReadonlyTransaction
): Promise<ChartViewsMap> {
    const chartViewsRows = await trx<DbPlainAnalyticsChartView>(
        AnalyticsChartViewsTableName
    ).select("chart_slug", "view_config_id", "views_7d", "type")

    const map: ChartViewsMap = {
        byConfigId: new Map<string, number>(),
        byGrapherSlug: new Map<string, number>(),
    }
    for (const row of chartViewsRows) {
        if (row.view_config_id) {
            map.byConfigId.set(row.view_config_id, row.views_7d)
        } else if (row.chart_slug) {
            map.byGrapherSlug.set(row.chart_slug, row.views_7d)
        }
    }
    return map
}

/**
 * Fetches a mapping from "explorerSlug:viewId" to chartConfigId
 * from the explorer_views table. This is needed to look up per-view
 * analytics for explorer views, since the indexing code identifies
 * views by (slug, viewId) but analytics are keyed by chartConfigId.
 */
export async function getExplorerViewConfigIds(
    trx: db.KnexReadonlyTransaction
): Promise<Map<string, string>> {
    const rows = await trx<DbRawExplorerView>(ExplorerViewsTableName)
        .select("explorerSlug", "viewId", "chartConfigId")
        .whereNotNull("chartConfigId")
    return new Map(
        rows.map((r) => [`${r.explorerSlug}:${r.viewId}`, r.chartConfigId!])
    )
}
