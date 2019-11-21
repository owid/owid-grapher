import { MigrationInterface, QueryRunner } from "typeorm"

export class RelativeToggleDefault1558617579232 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`
            UPDATE charts
            SET charts.config = JSON_SET(charts.config, '$.hideRelativeToggle', FALSE)
            WHERE charts.config->'$.hideRelativeToggle' IS NULL
            AND (
                charts.config->'$.type' = 'StackedArea'
                OR charts.config->'$.type' = 'ScatterPlot'
                OR charts.config->'$.type' = 'TimeScatter'
            )
        `)
        await queryRunner.query(`
            UPDATE charts
            SET charts.config = JSON_SET(charts.config, '$.hideRelativeToggle', TRUE)
            WHERE charts.config->'$.type' = 'LineChart'
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<any> {}
}
