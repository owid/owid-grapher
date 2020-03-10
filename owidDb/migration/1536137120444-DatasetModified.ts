import { MigrationInterface, QueryRunner } from "typeorm"

export class DatasetModified1536137120444 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(
            "ALTER TABLE entities CHANGE created_at createdAt DATETIME NOT NULL"
        )
        await queryRunner.query(
            "ALTER TABLE entities CHANGE updated_at updatedAt DATETIME NOT NULL"
        )

        // Add metadata modification tracking
        await queryRunner.query(
            "ALTER TABLE datasets ADD metadataEditedAt DATETIME"
        )
        await queryRunner.query(
            "ALTER TABLE datasets ADD metadataEditedByUserId INTEGER"
        )

        // Add data modification tracking
        await queryRunner.query(
            "ALTER TABLE datasets ADD dataEditedAt DATETIME"
        )
        await queryRunner.query(
            "ALTER TABLE datasets ADD dataEditedByUserId INTEGER"
        )

        // Set default timestamps and remove nullability
        await queryRunner.query(
            "UPDATE datasets SET metadataEditedAt = updatedAt"
        )
        await queryRunner.query(
            "ALTER TABLE datasets CHANGE metadataEditedAt metadataEditedAt DATETIME NOT NULL"
        )

        await queryRunner.query("UPDATE datasets SET dataEditedAt = updatedAt")
        await queryRunner.query(
            "ALTER TABLE datasets CHANGE dataEditedAt dataEditedAt DATETIME NOT NULL"
        )

        // Set default users and add foreign key constraints
        await queryRunner.query(
            "UPDATE datasets d JOIN variables v ON v.datasetId=d.id JOIN users u ON v.uploaded_by=u.name SET d.metadataEditedByUserId = u.id, d.dataEditedByUserId = u.id"
        )

        await queryRunner.query(
            "ALTER TABLE `datasets` ADD CONSTRAINT `datasets_metadataEditedByUserId` FOREIGN KEY (`metadataEditedByUserId`) REFERENCES `users`(`id`)"
        )
        await queryRunner.query(
            "ALTER TABLE `datasets` ADD CONSTRAINT `datasets_dataEditedByUserId` FOREIGN KEY (`dataEditedByUserId`) REFERENCES `users`(`id`)"
        )
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        throw new Error()
    }
}
