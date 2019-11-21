import { MigrationInterface, QueryRunner } from "typeorm"

export class AddForeignKeyConstraints1541082619105
    implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        // Remove duplicate foreign key
        await queryRunner.query(
            "ALTER TABLE `datasets` DROP FOREIGN KEY `FK_d717ea97450b05d06316d69501a`"
        )
        // Add missing foreign key constraints
        await queryRunner.query(
            "ALTER TABLE `dataset_files` ADD CONSTRAINT `dataset_files_datasetId` FOREIGN KEY (`datasetId`) REFERENCES `datasets`(`id`)"
        )
        await queryRunner.query(
            "ALTER TABLE `sources` ADD CONSTRAINT `sources_datasetId` FOREIGN KEY (`datasetId`) REFERENCES `datasets`(`id`)"
        )
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(
            "ALTER TABLE `datasets` ADD CONSTRAINT `FK_d717ea97450b05d06316d69501a` FOREIGN KEY (`createdByUserId`) REFERENCES `users` (`id`)"
        )
        await queryRunner.query(
            "ALTER TABLE `dataset_files` DROP FOREIGN KEY `dataset_files_datasetId`"
        )
        await queryRunner.query(
            "ALTER TABLE `sources` DROP FOREIGN KEY `sources_datasetId`"
        )
    }
}
