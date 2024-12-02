import { MigrationInterface, QueryRunner } from "typeorm"

export class EnableSlopeTabForAllLineCharts1733163041212
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            update chart_configs cc
            join charts c on cc.id = c.configId
            set
                patch = JSON_SET(cc.patch, '$.chartTypes', JSON_ARRAY('LineChart', 'SlopeChart')),
                full = JSON_SET(cc.full, '$.chartTypes', JSON_ARRAY('LineChart', 'SlopeChart'))
            where cc.chartType = 'LineChart'
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {}
}
