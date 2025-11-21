import { MigrationInterface, QueryRunner } from "typeorm"

export class DeduplicateChartSlugs1763545863214 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Find all duplicate slug groups
        const duplicateGroups = await queryRunner.query(`
            SELECT cc.slug
            FROM charts c
            JOIN chart_configs cc ON cc.id = c.configId
            WHERE cc.slug IS NOT NULL AND cc.slug != ''
            GROUP BY cc.slug
            HAVING COUNT(*) > 1
        `)

        console.log(
            `Found ${duplicateGroups.length} duplicate slug groups to process`
        )

        // Process each duplicate slug group
        for (const { slug } of duplicateGroups) {
            // Get all charts with this slug, ordered by: published first, then by chart ID (oldest first)
            const charts = await queryRunner.query(
                `
                SELECT
                    c.id as chartId,
                    cc.id as configId,
                    cc.full ->> '$.isPublished' = 'true' as isPublished
                FROM charts c
                JOIN chart_configs cc ON cc.id = c.configId
                WHERE cc.slug = ?
                ORDER BY
                    cc.full ->> '$.isPublished' = 'true' DESC,  -- published first
                    c.id ASC  -- then oldest first
            `,
                [slug]
            )

            // Keep the first chart (published if exists, otherwise oldest draft)
            // Rename all others
            for (let i = 1; i < charts.length; i++) {
                const chart = charts[i]
                const newSlug = `${slug}-draft-${chart.chartId}`

                console.log(
                    `Renaming chart ${chart.chartId}: "${slug}" → "${newSlug}"`
                )

                // Update slug in both patch and full JSON
                await queryRunner.query(
                    `
                    UPDATE chart_configs
                    SET patch = JSON_SET(patch, '$.slug', ?),
                        full = JSON_SET(full, '$.slug', ?)
                    WHERE id = ?
                `,
                    [newSlug, newSlug, chart.configId]
                )
            }
        }
    }

    public async down(): Promise<void> {
        // The migration is irreversible
    }
}
