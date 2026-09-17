import { MigrationInterface, QueryRunner } from "typeorm"

export class AddCatalogPathToCharts1787576345001 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Links an ETL-authored chart to the ETL step that currently owns it,
        // mirroring `multi_dim_data_pages.catalogPath` (e.g.
        // `animal_welfare/latest/banning_of_chick_culling#banning_of_chick_culling`).
        // Not an identifier — a chart is identified by its config UUID, which never
        // changes; this may change when a step is renamed or moved. Unique so one
        // path never names two charts. NULL for hand-authored charts.
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
