import { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Drop the `housekeeper_reviews` table.
 *
 * The housekeeper (the daily chart-review bot that lived in owid/etl) moved
 * to owid/analytics (owid/analytics#976, owid/etl#6550), and its review
 * ledger moved with it: the 508 rows here were copied to BigQuery
 * (`prod_internal_tools.housekeeper__reviews`) before the cutover, and the
 * new pipeline appends there. Nothing reads or writes this table anymore.
 */
export class DropHousekeeperReviews1785364982952 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE housekeeper_reviews`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Schema as created by 1736209905900-CreateHousekeeper.ts
        await queryRunner.query(`-- sql
            CREATE TABLE housekeeper_reviews (
                id INTEGER NOT NULL AUTO_INCREMENT PRIMARY KEY COMMENT "Identifier of the review",
                suggestedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT "Date where the review was suggested",
                objectType VARCHAR(255) NOT NULL COMMENT "Type of the object to review (e.g. 'chart', 'dataset', etc.)",
                objectId INTEGER NOT NULL COMMENT "ID of the object to review"
            )
        `)
    }
}
