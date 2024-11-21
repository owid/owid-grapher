import { MigrationInterface, QueryRunner } from "typeorm"

export class RemoveColorDimensionFromSlopeCharts1732195571407
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        // update dimensions field in chart configs
        await queryRunner.query(`
            -- sql
            UPDATE chart_configs
            SET
                patch = JSON_REPLACE(patch, '$.dimensions', JSON_ARRAY(patch -> '$.dimensions[0]')),
                full = JSON_REPLACE(full, '$.dimensions', JSON_ARRAY(full -> '$.dimensions[0]'))
            WHERE
                chartType = 'SlopeChart'
        `)

        // remove from chart_dimensions table
        await queryRunner.query(`
            -- sql
            DELETE cd FROM chart_dimensions cd
            JOIN charts c ON c.id = cd.chartId
            JOIN chart_configs cc ON c.configId = cc.id
            WHERE cc.chartType = 'SlopeChart' AND cd.property = 'color'
        `)
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public async down(): Promise<void> {}
}
