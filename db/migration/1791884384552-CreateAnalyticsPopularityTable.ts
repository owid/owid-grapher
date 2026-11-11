import { MigrationInterface, QueryRunner } from "typeorm"

export class CreateAnalyticsPopularityTable1791884384552 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // The analytics service creates and fills this table on prod, and the
        // dev snapshot ships it, but a database built from migrations alone
        // (the test databases) had none, so any indicator search failed there.
        // This copies the DDL that owid/analytics owns in
        // analytics/export_to_mysql/schemas.yml
        await queryRunner.query(`-- sql
            CREATE TABLE IF NOT EXISTS analytics_popularity (
                type VARCHAR(50) NOT NULL,
                slug VARCHAR(512) NOT NULL,
                popularity FLOAT NOT NULL,
                PRIMARY KEY (type, slug),
                KEY idx_type_popularity (type, popularity DESC)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs`)
    }

    public async down(): Promise<void> {
        // Nothing to undo: where the table existed, `up` left it alone, and
        // dropping it would delete the analytics service's data
    }
}
