import * as db from "../../../db.js"

/**
 * Gdocs with chart components pointing at charts, multi-dims, narrative charts
 * or explorers whose config or
 * data changed since the given date, i.e. those whose preview images may be outdated.
 *
 * This is deliberately generous (indicators are touched by every ETL run, even
 * if their data stays the same): refreshing a doc whose images are already up
 * to date only costs a read of the doc, since the image URLs carry a version
 * hash of the actual data.
 */
export async function getGdocIdsWithChangedCharts(
    knex: db.KnexReadonlyTransaction,
    since: Date
): Promise<string[]> {
    const rows = await db.knexRaw<{ gdocId: string }>(
        knex,
        `-- sql
        WITH changed_charts AS (
            SELECT c.id
            FROM charts c
            JOIN chart_configs cc ON cc.id = c.configId
            WHERE cc.updatedAt >= ?
            UNION
            SELECT cd.chartId AS id
            FROM chart_dimensions cd
            JOIN variables v ON v.id = cd.variableId
            WHERE v.updatedAt >= ?
        ),
        changed_multi_dims AS (
            SELECT id
            FROM multi_dim_data_pages
            WHERE updatedAt >= ?
            UNION
            SELECT mx.multiDimId AS id
            FROM multi_dim_x_chart_configs mx
            JOIN chart_configs cc ON cc.id = mx.chartConfigId
            WHERE cc.updatedAt >= ?
            UNION
            SELECT mx.multiDimId AS id
            FROM multi_dim_x_chart_configs mx
            JOIN variables v ON v.id = mx.variableId
            WHERE v.updatedAt >= ?
        ),
        changed_slugs AS (
            SELECT cc.slug
            FROM changed_charts ch
            JOIN charts c ON c.id = ch.id
            JOIN chart_configs cc ON cc.id = c.configId
            UNION
            SELECT r.slug
            FROM changed_charts ch
            JOIN chart_slug_redirects r ON r.chart_id = ch.id
            UNION
            SELECT m.slug
            FROM changed_multi_dims cm
            JOIN multi_dim_data_pages m ON m.id = cm.id
            UNION
            -- Old chart slugs that now redirect to a multi-dim
            SELECT REPLACE(mdr.source, '/grapher/', '')
            FROM changed_multi_dims cm
            JOIN multi_dim_redirects mdr ON mdr.multiDimId = cm.id
            WHERE mdr.source LIKE '/grapher/%'
        ),
        changed_narrative_charts AS (
            -- The merged config is rewritten when the parent chart changes
            SELECT nc.name
            FROM narrative_charts nc
            JOIN chart_configs cc ON cc.id = nc.chartConfigId
            WHERE nc.updatedAt >= ? OR cc.updatedAt >= ?
            UNION
            SELECT nc.name
            FROM narrative_charts nc
            JOIN chart_dimensions cd ON cd.chartId = nc.parentChartId
            JOIN variables v ON v.id = cd.variableId
            WHERE v.updatedAt >= ?
            UNION
            SELECT nc.name
            FROM narrative_charts nc
            JOIN multi_dim_x_chart_configs mx
                ON mx.id = nc.parentMultiDimXChartConfigId
            JOIN variables v ON v.id = mx.variableId
            WHERE v.updatedAt >= ?
        ),
        changed_explorers AS (
            SELECT slug
            FROM explorers
            WHERE updatedAt >= ?
            UNION
            SELECT ev.explorerSlug AS slug
            FROM explorer_views ev
            JOIN chart_configs cc ON cc.id = ev.chartConfigId
            WHERE cc.updatedAt >= ?
            UNION
            SELECT ev.explorerSlug AS slug
            FROM explorer_variables ev
            JOIN variables v ON v.id = ev.variableId
            WHERE v.updatedAt >= ?
            UNION
            SELECT ec.explorerSlug AS slug
            FROM explorer_charts ec
            JOIN chart_dimensions cd ON cd.chartId = ec.chartId
            JOIN variables v ON v.id = cd.variableId
            WHERE v.updatedAt >= ?
            UNION
            -- Explorers that now redirect to a multi-dim
            SELECT REPLACE(mdr.source, '/explorers/', '')
            FROM changed_multi_dims cm
            JOIN multi_dim_redirects mdr ON mdr.multiDimId = cm.id
            WHERE mdr.source LIKE '/explorers/%'
        )
        SELECT DISTINCT l.sourceId AS gdocId
        FROM posts_gdocs_links l
        JOIN changed_slugs s ON s.slug = l.target
        WHERE l.linkType = 'grapher' AND l.componentType = 'chart'
        UNION
        SELECT l.sourceId AS gdocId
        FROM posts_gdocs_links l
        JOIN changed_narrative_charts n ON n.name = l.target
        WHERE l.linkType = 'narrative-chart'
        UNION
        SELECT l.sourceId AS gdocId
        FROM posts_gdocs_links l
        JOIN changed_explorers e ON e.slug = l.target
        WHERE l.linkType = 'explorer' AND l.componentType = 'chart'`,
        Array(13).fill(since)
    )
    return rows.map((row) => row.gdocId)
}
