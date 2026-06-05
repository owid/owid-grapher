import { MigrationInterface, QueryRunner } from "typeorm"

export class AddConfigIdEtlToCharts1779983981061 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // A chart's ETL-authored grapher config lives in its own chart_configs
        // row, reached via this pointer — mirroring variables.grapherConfigIdETL.
        // The rendered `full` of the chart's main config row is
        // merge(variableETL, etlConfig, patch), where etlConfig is the config
        // row pointed to here. NULL means the chart has no ETL-authored layer.
        await queryRunner.query(
            `-- sql
            ALTER TABLE charts
                ADD COLUMN configIdETL char(36) UNIQUE NULL AFTER configId,
                ADD CONSTRAINT fk_charts_configIdETL
                    FOREIGN KEY (configIdETL)
                    REFERENCES chart_configs (id)
                    ON DELETE RESTRICT
                    ON UPDATE RESTRICT;`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `-- sql
            ALTER TABLE charts
                DROP FOREIGN KEY fk_charts_configIdETL,
                DROP COLUMN configIdETL;`
        )
    }
}
