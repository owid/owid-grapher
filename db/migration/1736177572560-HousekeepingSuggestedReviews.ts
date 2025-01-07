import { MigrationInterface, QueryRunner } from "typeorm"

export class HousekeepingSuggestedReviews1736177572560
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            CREATE TABLE IF NOT EXISTS housekeeping_suggested_reviews (
                id INTEGER NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT "Identifier of the review",
                suggestedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT "Date where the review was suggested",
                objectType VARCHAR(255) NOT NULL UNIQUE COMMENT "Type of the object to review (e.g. 'chart', 'dataset', etc.)",
                objectId CHAR(36) NOT NULL COMMENT "ID of the object to review"
            )
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE housekeeping_suggested_reviews`)
    }
}
