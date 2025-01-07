import { MigrationInterface, QueryRunner } from "typeorm"

export class CreateHousekeeper1736209905900 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            CREATE TABLE housekeeper_reviews (
                id INTEGER NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT "Identifier of the review",
                suggestedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT "Date where the review was suggested",
                objectType VARCHAR(255) NOT NULL COMMENT "Type of the object to review (e.g. 'chart', 'dataset', etc.)",
                objectId INTEGER NOT NULL COMMENT "ID of the object to review"
            )
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE housekeeper_reviews`)
    }
}
