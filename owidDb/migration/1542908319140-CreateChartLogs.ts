import { MigrationInterface, QueryRunner } from "typeorm"

export class CreateChartLogs1542908319140 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(
            "CREATE TABLE `chart_revisions` (`id` bigint NOT NULL AUTO_INCREMENT, `chartId` int, `userId` int, `config` json, `createdAt` datetime, `updatedAt` datetime, PRIMARY KEY(`id`)) ENGINE=InnoDB"
        )

        // Create one log for each existing chart
        const charts = await queryRunner.query(
            "SELECT id, config, updatedAt, lastEditedByUserId FROM charts"
        )

        let chartRevisions = []
        for (let i = 0; i < charts.length; i++) {
            const chart = charts[i]
            chartRevisions.push([
                chart.id,
                chart.lastEditedByUserId,
                chart.updatedAt,
                chart.updatedAt,
                chart.config
            ])

            if (i % 100 === 0 || i === charts.length - 1) {
                await queryRunner.query(
                    "INSERT INTO chart_revisions (chartId, userId, createdAt, updatedAt, config) VALUES ?",
                    [chartRevisions]
                )
                chartRevisions = []
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("DROP TABLE IF EXISTS `chart_revisions` ")
    }
}
