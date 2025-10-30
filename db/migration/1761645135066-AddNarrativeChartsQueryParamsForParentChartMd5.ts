import { MigrationInterface, QueryRunner } from "typeorm"

export class AddNarrativeChartsQueryParamsForParentChartMd51761645135066
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE narrative_charts
            MODIFY COLUMN queryParamsForParentChart JSON NOT NULL,
            ADD COLUMN queryParamsForParentChartMd5 CHAR(24) GENERATED ALWAYS AS (to_base64(unhex(md5(queryParamsForParentChart)))) STORED NOT NULL AFTER queryParamsForParentChart
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE narrative_charts
            DROP COLUMN queryParamsForParentChartMd5,
            MODIFY COLUMN queryParamsForParentChart JSON NULL
        `)
    }
}
