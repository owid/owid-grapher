import { MigrationInterface, QueryRunner } from "typeorm"

export class ChartTags1543998321360 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(
            "CREATE TABLE `chart_tags` (`chartId` int NOT NULL, `tagId` int NOT NULL, PRIMARY KEY (`chartId`, `tagId`)) ENGINE=InnoDB"
        )
        await queryRunner.query(
            "ALTER TABLE `chart_tags` ADD CONSTRAINT `FK_chart_tags_chartId` FOREIGN KEY (`chartId`) REFERENCES `charts`(`id`) ON DELETE CASCADE"
        )
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("DROP TABLE chart_tags")
    }
}
