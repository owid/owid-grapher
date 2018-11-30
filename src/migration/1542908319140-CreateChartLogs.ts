import {MigrationInterface, QueryRunner} from "typeorm"

export class CreateChartLogs1542908319140 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("CREATE TABLE `chart_logs` (`id` bigint NOT NULL AUTO_INCREMENT, `chartId` int, `userId` int, `config` json, `createdAt` datetime, `updatedAt` datetime, PRIMARY KEY(`id`)) ENGINE=InnoDB")
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("DROP TABLE IF EXISTS `chart_logs` ")
    }

}
