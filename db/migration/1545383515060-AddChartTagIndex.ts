import { MigrationInterface, QueryRunner } from "typeorm"

export class AddChartTagIndex1545383515060 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(
            "ALTER TABLE `chart_tags` ADD CONSTRAINT `FK_chart_tags_tagId` FOREIGN KEY (`tagId`) REFERENCES `tags`(`id`)"
        )
    }

    public async down(queryRunner: QueryRunner): Promise<any> {}
}
