import { QueryRunner } from "typeorm"

/**
 * Helper utilities for managing the chart_references_view.
 *
 * This view tracks how many times each chart is referenced across different parts of the system.
 * When adding a new type of chart reference, follow these steps:
 *
 * 1. Add a new entry to the REFERENCE_SOURCES object with:
 *    - A unique key (e.g., "myNewRef")
 *    - cteName: The name for the CTE (Common Table Expression)
 *    - query: SQL that returns chartId and count columns
 *
 * 2. Create a migration that calls createChartReferencesView() with the updated sources:
 *    ```typescript
 *    import { createChartReferencesView, REFERENCE_SOURCES } from "./chartReferencesViewHelper.js"
 *
 *    export class AddMyNewRefToChartReferencesView implements MigrationInterface {
 *        public async up(queryRunner: QueryRunner): Promise<void> {
 *            await createChartReferencesView(queryRunner, [
 *                REFERENCE_SOURCES.gdocs,
 *                REFERENCE_SOURCES.explorer,
 *                REFERENCE_SOURCES.myNewRef,
 *            ])
 *        }
 *
 *        public async down(queryRunner: QueryRunner): Promise<void> {
 *            // Recreate without the new source
 *            await createChartReferencesView(queryRunner, [
 *                REFERENCE_SOURCES.gdocs,
 *                REFERENCE_SOURCES.explorer,
 *            ])
 *        }
 *    }
 *    ```
 */

/**
 * Configuration for a reference source that counts how many times charts are referenced.
 * Each reference source adds a CTE (Common Table Expression) to the chart_references_view.
 */
interface ReferenceSource {
    /** Name of the CTE that will be created */
    cteName: string
    /** SQL query that returns chartId and count columns */
    query: string
}

/**
 * All available reference sources that can be included in the chart_references_view.
 * Each represents a different way that charts can be referenced in the system.
 */
export const REFERENCE_SOURCES = {
    gdocs: {
        cteName: "gdocs_refs",
        query: `
                SELECT csm.chartId, COUNT(DISTINCT pgl.sourceId) as count
                FROM chart_slug_mapping csm
                JOIN posts_gdocs_links pgl ON pgl.target = csm.target_slug
                JOIN posts_gdocs pg ON pg.id = pgl.sourceId
                WHERE pg.published = true
                  AND pg.type NOT IN ('fragment', 'about-page')
                GROUP BY csm.chartId`,
    },
    explorer: {
        cteName: "explorer_refs",
        query: `
                SELECT ec.chartId, COUNT(DISTINCT ec.explorerSlug) as count
                FROM explorer_charts ec
                JOIN explorers e ON ec.explorerSlug = e.slug
                WHERE e.isPublished = 1
                GROUP BY ec.chartId`,
    },
    staticViz: {
        cteName: "static_viz_refs",
        query: `
                SELECT c.id as chartId, COUNT(DISTINCT sv.id) as count
                FROM charts c
                JOIN chart_configs cc ON c.configId = cc.id
                JOIN static_viz sv ON sv.grapherSlug = cc.slug
                GROUP BY c.id`,
    },
} as const

/**
 * Generates the SQL to create the chart_references_view with the given reference sources.
 *
 * The view provides a count of how many times each chart is referenced across different
 * parts of the system. It includes:
 * - narrativeChartsCount: Number of narrative charts that reference this chart
 * - referencesCount: Total count of references from all configured sources
 *
 * @param referenceSources - Array of reference sources to include in the view
 * @returns SQL string to create the view
 */
function generateChartReferencesViewSQL(
    referenceSources: ReferenceSource[]
): string {
    // Generate the CTE definitions
    const cteDefinitions = referenceSources
        .map((source) => `${source.cteName} AS (${source.query})`)
        .join(",\n            ")

    const leftJoins = referenceSources
        .map((source, index) => {
            // Safer alias generation
            const alias = `ref_${index}`
            return `LEFT JOIN ${source.cteName} ${alias} ON ${alias}.chartId = c.id`
        })
        .join("\n            ")

    const referenceCounts = referenceSources
        .map((source, index) => {
            const alias = `ref_${index}`
            return `COALESCE(${alias}.count, 0)`
        })
        .join(" + ")

    return `
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
            ${cteDefinitions}
            SELECT
                c.id as chartId,
                COALESCE(ncc.narrativeChartsCount, 0) as narrativeChartsCount,
                ${referenceCounts} as referencesCount
            FROM charts c
            LEFT JOIN narrative_chart_counts ncc ON ncc.parentChartId = c.id
            ${leftJoins}
        `
}

/**
 * Creates or recreates the chart_references_view with the specified reference sources.
 *
 * @param queryRunner - TypeORM QueryRunner to execute the SQL
 * @param referenceSources - Optional array of reference sources to include. Defaults to all reference sources.
 */
export async function createChartReferencesView(
    queryRunner: QueryRunner,
    referenceSources: ReferenceSource[]
): Promise<void> {
    await queryRunner.query(`DROP VIEW IF EXISTS chart_references_view`)
    await queryRunner.query(generateChartReferencesViewSQL(referenceSources))
}

/**
 * Drops the chart_references_view.
 *
 * @param queryRunner - TypeORM QueryRunner to execute the SQL
 */
export async function dropChartReferencesView(
    queryRunner: QueryRunner
): Promise<void> {
    await queryRunner.query(`DROP VIEW IF EXISTS chart_references_view`)
}
