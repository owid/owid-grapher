import { MigrationInterface, QueryRunner } from "typeorm"

export class AddCatalogPathToCharts1780587927881 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Links an ETL-authored chart to the ETL step that produced it, mirroring
        // `multi_dim_data_pages.catalogPath`. This is the chart's stable ETL identity
        // (e.g. `animal_welfare/latest/banning_of_chick_culling#banning_of_chick_culling`),
        // distinct from the mutable, admin-managed `slug`. NULL for hand-authored charts.
        await queryRunner.query(
            `-- sql
            ALTER TABLE charts
            ADD COLUMN catalogPath VARCHAR(767) NULL AFTER id,
            ADD UNIQUE INDEX idx_charts_catalog_path (catalogPath)`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `-- sql
            ALTER TABLE charts
            DROP INDEX idx_charts_catalog_path,
            DROP COLUMN catalogPath`
        )
    }
}
