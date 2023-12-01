import { MigrationInterface, QueryRunner } from "typeorm"

export class CreateAnalyticsCharts1701446901429 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // index on slug
        await queryRunner.query(`
            CREATE TABLE analytics_charts (
                chart_id INT NOT NULL,
                slug VARCHAR(180) NOT NULL,
                views_7d INT NOT NULL,
                views_14d INT NOT NULL,
                views_365d INT NOT NULL,
                url VARCHAR(255) NOT NULL,
                updated_at DATETIME NOT NULL,
                PRIMARY KEY (chart_id)
            );
        `)
        await queryRunner.query(`
            CREATE INDEX analytics_charts_slug ON analytics_charts (slug);
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP INDEX IF EXISTS analytics_charts_slug;
        `)
        await queryRunner.query(`
            DROP TABLE IF EXISTS analytics_charts;
        `)
    }
}
