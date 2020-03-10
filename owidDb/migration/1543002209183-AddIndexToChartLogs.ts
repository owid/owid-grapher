import { MigrationInterface, QueryRunner } from "typeorm"

export class AddIndexToChartLogs1543002209183 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(
            "CREATE INDEX `chartId` ON chart_revisions(chartId)"
        )
    }

    public async down(queryRunner: QueryRunner): Promise<any> {}
}
