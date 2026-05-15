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
    const rows = await db.knexRaw<{
        chart_slug: string
        view_config_id: string
        views_7d: number
    }>(
        trx,
        `SELECT chart_slug, view_config_id, views_7d
         FROM analytics_chart_views`
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
    const rows = await db.knexRaw<{
        explorerSlug: string
        viewId: string
        chartConfigId: string
    }>(
        trx,
        `SELECT explorerSlug, viewId, chartConfigId
         FROM explorer_views
         WHERE chartConfigId IS NOT NULL`
    )
    return new Map(
        rows.map((r) => [`${r.explorerSlug}:${r.viewId}`, r.chartConfigId])
    )
}

/**
 * Given a ChartViewsMap and a list of keys, returns the max views_7d.
 *
 * This is used for grapher charts which can be accessed via multiple slugs
 * (the canonical slug plus redirect slugs). When a chart is renamed, the
 * new canonical slug may have few or zero views while the old slug (now a
 * redirect) retains the historical view count. Taking the max ensures we
 * don't lose the view signal just because a chart was recently renamed.
 */
export function getMaxViews(views: ChartViewsMap, keys: string[]): number {
    let max = 0
    for (const key of keys) {
        const v = views.get(key) ?? 0
        if (v > max) max = v
    }
    return max
}
