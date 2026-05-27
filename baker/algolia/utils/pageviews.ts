import {
    AnalyticsChartViewsTableName,
    AnalyticsChartViewsType,
    ChartViewsMap,
    DbPlainAnalyticsChartViewsRow,
    DbRawExplorerView,
    ExplorerViewsTableName,
} from "@ourworldindata/types"
import * as db from "../../../db/db.js"

/**
 * Fetches all rows from analytics_chart_views and builds a single lookup map.
 * First level is by type (grapher_chart, explorer, multidim), second level is by chart_slug or view_config_id depending on type.
 */
export async function getAnalyticsChartViews(
    trx: db.KnexReadonlyTransaction
): Promise<ChartViewsMap> {
    const rows = await trx<DbPlainAnalyticsChartViewsRow>(
        AnalyticsChartViewsTableName
    ).select("chart_slug", "view_config_id", "views_7d", "type")
    const map: ChartViewsMap = {
        grapher_chart: new Map<string, number>(),
        explorer: new Map<string, number>(),
        multidim: new Map<string, number>(),
    }
    for (const row of rows) {
        const key =
            row.type === "grapher_chart"
                ? row.chart_slug
                : row.view_config_id || row.chart_slug
        map[row.type].set(key, row.views_7d)
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
 */
export function getMaxChartViews(
    chartViewsMap: ChartViewsMap,
    keys: { id: string; type: AnalyticsChartViewsType }[]
): number {
    let max = 0
    for (const key of keys) {
        const v = chartViewsMap[key.type].get(key.id) ?? 0
        if (v > max) max = v
    }
    return max
}
