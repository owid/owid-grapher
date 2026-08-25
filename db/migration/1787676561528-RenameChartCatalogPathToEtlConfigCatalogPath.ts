import { MigrationInterface, QueryRunner } from "typeorm"

/**
 * `charts.catalogPath` names the ETL step that authored the chart's ETL config
 * layer, so spell that out in the column name — a bare `catalogPath` on charts
 * reads like a chart-level identifier, which it deliberately isn't.
 */
export class RenameChartCatalogPathToEtlConfigCatalogPath1787676561528
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `-- sql
            ALTER TABLE charts
            RENAME COLUMN catalogPath TO etlConfigCatalogPath,
            RENAME INDEX idx_charts_catalog_path
                TO idx_charts_etl_config_catalog_path`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `-- sql
            ALTER TABLE charts
            RENAME COLUMN etlConfigCatalogPath TO catalogPath,
            RENAME INDEX idx_charts_etl_config_catalog_path
                TO idx_charts_catalog_path`
        )
    }
}
