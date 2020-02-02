import { Chart } from "db/model/Chart"
import { MigrationInterface, QueryRunner } from "typeorm"

export class MultipleComparisonLines1546720280923
    implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        const charts = await Chart.find()
        for (const chart of charts) {
            if (chart.config.comparisonLine) {
                chart.config.comparisonLines = [chart.config.comparisonLine]
                delete chart.config.comparisonLine
                await chart.save()
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<any> {}
}
