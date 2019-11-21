import { MigrationInterface, QueryRunner } from "typeorm"

export class DatasetTrackingCleanup1536214773165 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(
            "UPDATE datasets SET dataEditedByUserId=15 WHERE dataEditedByUserId IS NULL"
        )
        await queryRunner.query(
            "UPDATE datasets SET metadataEditedByUserId=15 WHERE metadataEditedByUserId IS NULL"
        )
        await queryRunner.query(
            "UPDATE datasets SET createdByUserId=dataEditedByUserId"
        )

        await queryRunner.query(
            "ALTER TABLE datasets CHANGE dataEditedByUserId dataEditedByUserId INTEGER NOT NULL"
        )
        await queryRunner.query(
            "ALTER TABLE datasets CHANGE metadataEditedByUserId metadataEditedByUserId INTEGER NOT NULL"
        )
        await queryRunner.query(
            "ALTER TABLE datasets CHANGE createdByUserId createdByUserId INTEGER NOT NULL"
        )

        await queryRunner.query(
            "ALTER TABLE `datasets` ADD CONSTRAINT `datasets_createdByUserId` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`)"
        )
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        throw new Error()
    }
}
