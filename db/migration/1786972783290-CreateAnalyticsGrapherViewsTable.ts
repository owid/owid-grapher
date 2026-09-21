import { MigrationInterface, QueryRunner } from "typeorm"

// This table is owned and populated by the external analytics service (see
// owid/analytics). It already exists in production and staging, but is absent
// from local/test databases built purely from migrations. Creating it
// idempotently makes the schema available in those environments without
// modifying an existing analytics-managed table.
export class CreateAnalyticsGrapherViewsTable1786972783290 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            CREATE TABLE IF NOT EXISTS analytics_grapher_views (
                day DATE NOT NULL,
                grapher_slug VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL,
                views_7d INT UNSIGNED NOT NULL,
                views_14d INT UNSIGNED NOT NULL,
                views_365d INT UNSIGNED NOT NULL,
                PRIMARY KEY (day, grapher_slug),
                INDEX idx_grapher_slug (grapher_slug)
            )
        `)
    }

    public async down(): Promise<void> {
        // Intentionally a no-op: this table is externally owned and predates
        // this migration, so rolling back must not delete analytics data.
    }
}
