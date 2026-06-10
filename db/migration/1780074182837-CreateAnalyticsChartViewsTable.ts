import { MigrationInterface, QueryRunner } from "typeorm"

// The analytics_chart_views table is owned and populated by the external
// analytics service (see owid/analytics). It already exists in production and
// staging, but is absent from local/test databases that are built purely from
// these migrations. This migration creates it idempotently so it's available
// for DB tests and local development.
//
// Schema mirrors the definition used by the analytics sync script. We use
// CREATE TABLE IF NOT EXISTS so applying this migration against prod/staging
// (where the analytics service already created the table) is a no-op rather
// than an error. For the same reason, down() intentionally does NOT drop the
// table: it's externally owned and pre-dates this migration, so a rollback
// must not delete the analytics service's data.
export class CreateAnalyticsChartViewsTable1780074182837 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            CREATE TABLE IF NOT EXISTS analytics_chart_views (
                day DATE NOT NULL,
                chart_slug VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL,
                view_config_id VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL DEFAULT '',
                type VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL,
                views_7d INT UNSIGNED NOT NULL,
                views_14d INT UNSIGNED NOT NULL,
                views_365d INT UNSIGNED NOT NULL,
                PRIMARY KEY (day, chart_slug, view_config_id, type),
                INDEX idx_chart_slug (chart_slug),
                INDEX idx_view_config_id (view_config_id),
                INDEX idx_type (type)
            )
        `)
    }

    public async down(): Promise<void> {
        // Intentionally a no-op — see comment above. The analytics_chart_views
        // table is owned by the external analytics service, so we must not drop
        // it on rollback.
    }
}
