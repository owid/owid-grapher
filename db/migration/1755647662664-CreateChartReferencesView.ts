import { MigrationInterface, QueryRunner } from "typeorm"

export class CreateChartReferencesView1755647662664
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE VIEW chart_references_view AS
            WITH
            chart_slug_mapping AS (
                -- Direct chart slug mappings
                SELECT c.id as chartId, cc.slug as target_slug
                FROM charts c
                JOIN chart_configs cc ON c.configId = cc.id
                UNION ALL
                -- Redirect slug mappings
                SELECT cr.chart_id as chartId, cr.slug as target_slug
                FROM chart_slug_redirects cr
            ),
            narrative_chart_counts AS (
                SELECT parentChartId, COUNT(*) as narrativeChartsCount
                FROM narrative_charts
                GROUP BY parentChartId
            ),
            gdocs_refs AS (
                SELECT csm.chartId, COUNT(DISTINCT pgl.sourceId) as count
                FROM chart_slug_mapping csm
                JOIN posts_gdocs_links pgl ON pgl.target = csm.target_slug
                JOIN posts_gdocs pg ON pg.id = pgl.sourceId
                WHERE pg.published = true
                  AND pg.type NOT IN ('fragment', 'about-page')
                GROUP BY csm.chartId
            ),
            explorer_refs AS (
                SELECT ec.chartId, COUNT(DISTINCT ec.explorerSlug) as count
                FROM explorer_charts ec
                JOIN explorers e ON ec.explorerSlug = e.slug
                WHERE e.isPublished = 1
                GROUP BY ec.chartId
            )
            SELECT
                c.id as chartId,
                COALESCE(ncc.narrativeChartsCount, 0) as narrativeChartsCount,
                COALESCE(gr.count, 0) + COALESCE(er.count, 0) as referencesCount
            FROM charts c
            LEFT JOIN narrative_chart_counts ncc ON ncc.parentChartId = c.id
            LEFT JOIN gdocs_refs gr ON gr.chartId = c.id
            LEFT JOIN explorer_refs er ON er.chartId = c.id
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP VIEW IF EXISTS chart_references_view`)
    }
}
