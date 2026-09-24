import * as db from "../../../db.js"

/**
 * Gdocs with chart components pointing at charts whose config or data changed
 * since the given date, i.e. those whose preview images may be outdated.
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
        changed_slugs AS (
            SELECT cc.slug
            FROM changed_charts ch
            JOIN charts c ON c.id = ch.id
            JOIN chart_configs cc ON cc.id = c.configId
            UNION
            SELECT r.slug
            FROM changed_charts ch
            JOIN chart_slug_redirects r ON r.chart_id = ch.id
        )
        SELECT DISTINCT l.sourceId AS gdocId
        FROM posts_gdocs_links l
        JOIN changed_slugs s ON s.slug = l.target
        WHERE l.linkType = 'grapher' AND l.componentType = 'chart'`,
        [since, since]
    )
    return rows.map((row) => row.gdocId)
}
