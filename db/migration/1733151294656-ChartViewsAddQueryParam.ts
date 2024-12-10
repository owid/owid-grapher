import { MigrationInterface, QueryRunner } from "typeorm"

export class ChartViewsAddQueryParam1733151294656
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE chart_views ADD COLUMN queryParamsForParentChart JSON NULL AFTER parentChartId;
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE chart_views DROP COLUMN queryParamsForParentChart;
        `)
    }
}
