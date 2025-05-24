import { MigrationInterface, QueryRunner } from "typeorm"

export class MultiDimNarrativeCharts1747214839803
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `-- sql
            ALTER TABLE narrative_charts
            MODIFY COLUMN parentChartId INT NULL,
            ADD COLUMN parentMultiDimXChartConfigId INT UNSIGNED NULL AFTER parentChartId,
            ADD CONSTRAINT fk_narrative_charts_parent_multi_dim_x_chart_config_id
                FOREIGN KEY (parentMultiDimXChartConfigId)
                REFERENCES multi_dim_x_chart_configs(id),
            ADD CONSTRAINT check_narrative_charts_single_parent
                CHECK (parentChartId IS NULL XOR parentMultiDimXChartConfigId IS NULL)`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `-- sql
            ALTER TABLE narrative_charts
            DROP CHECK check_narrative_charts_single_parent,
            DROP FOREIGN KEY fk_narrative_charts_parent_multi_dim_x_chart_config_id,
            DROP COLUMN parentMultiDimXChartConfigId,
            MODIFY COLUMN parentChartId INT NOT NULL`
        )
    }
}
