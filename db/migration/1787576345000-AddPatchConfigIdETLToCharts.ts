import { MigrationInterface, QueryRunner } from "typeorm"

export class AddPatchConfigIdETLToCharts1787576345000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // A chart's ETL-authored config layer lives in its own chart_configs
        // row, reached via this pointer — mirroring variables.patchConfigIdETL,
        // but per chart rather than per indicator. Like charts.patchConfigId it
        // names an authored layer, never a config that renders.
        await queryRunner.query(
            `-- sql
            ALTER TABLE charts
                ADD COLUMN patchConfigIdETL char(36) UNIQUE NULL AFTER patchConfigId,
                ADD CONSTRAINT fk_charts_patchConfigIdETL
                    FOREIGN KEY (patchConfigIdETL)
                    REFERENCES chart_configs (id)
                    ON DELETE RESTRICT
                    ON UPDATE RESTRICT;`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `-- sql
            ALTER TABLE charts
                DROP FOREIGN KEY fk_charts_patchConfigIdETL,
                DROP COLUMN patchConfigIdETL;`
        )
    }
}
