import { MigrationInterface, QueryRunner } from "typeorm"

export class LineChartYMaxZero1647866984314 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        queryRunner.query(`
            UPDATE charts
            SET config = JSON_SET(config, "$.yAxis.max", 0)
            WHERE (
                config->"$.type" = "LineChart" OR
                config->"$.type" IS NULL
            )
            AND config->"$.yAxis.min" = 0
            AND config->"$.yAxis.max" IS NULL
        `)
    }

    public async down(): Promise<void> {
        // no going back
    }
}
