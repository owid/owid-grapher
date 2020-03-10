import { MigrationInterface, QueryRunner } from "typeorm"

// Transform subcategories into tags

export class Tags1535683674417 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query("RENAME TABLE dataset_subcategories TO tags")
        await queryRunner.query(
            "CREATE TABLE `dataset_tags` (`datasetId` int NOT NULL, `tagId` int NOT NULL, PRIMARY KEY (`datasetId`, `tagId`)) ENGINE=InnoDB"
        )
        await queryRunner.query(
            "ALTER TABLE `dataset_tags` ADD CONSTRAINT `FK_fa434de5c36953f4efce6b073b3` FOREIGN KEY (`datasetId`) REFERENCES `datasets`(`id`) ON DELETE CASCADE"
        )
        await queryRunner.query(
            "ALTER TABLE `dataset_tags` ADD CONSTRAINT `FK_2e330c9e1074b457d1d238b2dac` FOREIGN KEY (`tagId`) REFERENCES `tags`(`id`) ON DELETE CASCADE"
        )

        for (const dataset of await queryRunner.query(
            "SELECT id, subcategoryId FROM datasets"
        )) {
            await queryRunner.query(
                "INSERT INTO dataset_tags (datasetId, tagId) VALUES (?, ?)",
                [dataset.id, dataset.subcategoryId]
            )
        }
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        throw new Error()
    }
}
