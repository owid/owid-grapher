import { MigrationInterface, QueryRunner } from "typeorm"

export class AddEtlConfigToChartConfigs1779983981061 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Adds a third layer to chart_configs: `etlConfig` is written by ETL
        // (independent of any indicator's grapher_config) and merged into
        // `full` alongside the variable's ETL config and the admin `patch`.
        //
        // For all existing rows, `etlConfig` is NULL, so the new merge layer
        // is empty and the rendered `full` is unchanged.
        await queryRunner.query(
            `-- sql
            ALTER TABLE chart_configs
                ADD COLUMN etlConfig JSON NULL AFTER full;`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `-- sql
            ALTER TABLE chart_configs
                DROP COLUMN etlConfig;`
        )
    }
}
