import {
    AnalyticsChartViewsTableName,
    DbPlainAnalyticsChartViewsRow,
    DbRawExplorerView,
    ExplorerViewsTableName,
} from "@ourworldindata/types"
import * as db from "../../../db/db.js"

/** Map from lookup key to views_7d count */
export type ChartViewsMap = Map<string, number>

/**
 * Fetches all rows from analytics_chart_views and builds a single lookup map.
 *
 * - For `grapher_chart` rows (where view_config_id is empty), keyed by chart_slug.
 * - For `explorer` and `multidim` rows, keyed by view_config_id (a chart config UUID).
 */
export async function getAnalyticsChartViews(
    trx: db.KnexReadonlyTransaction
): Promise<ChartViewsMap> {
    const rows = await trx<
        Pick<
            DbPlainAnalyticsChartViewsRow,
            "chart_slug" | "view_config_id" | "views_7d"
        >
    >(AnalyticsChartViewsTableName).select(
        "chart_slug",
        "view_config_id",
        "views_7d"
    )
    const map = new Map<string, number>()
    for (const row of rows) {
        const key = row.view_config_id || row.chart_slug
        map.set(key, row.views_7d)
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

/**
 * Given a ChartViewsMap and a list of keys, returns the max views_7d.
 * e.g. { "chart-slug-1": 100, "chart-slug-2": 200 }, ["chart-slug-1", "chart-slug-2"] => 200
 * or for multi-dims: { "chart-config-uuid-1": 100, "chart-config-uuid-2": 200 }, ["chart-config-uuid-1", "chart-config-uuid-2"] => 200
 */
export function getMaxChartViews(views: ChartViewsMap, keys: string[]): number {
    let max = 0
    for (const key of keys) {
        const v = views.get(key) ?? 0
        if (v > max) max = v
    }
    return max
}
