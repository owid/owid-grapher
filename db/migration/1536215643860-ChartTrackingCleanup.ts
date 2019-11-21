import { MigrationInterface, QueryRunner } from "typeorm"

export class ChartTrackingCleanup1536215643860 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(
            "UPDATE charts SET lastEditedByUserId=2 WHERE lastEditedByUserId IS NULL"
        )
        await queryRunner.query(
            "ALTER TABLE charts CHANGE lastEditedByUserId lastEditedByUserId INTEGER NOT NULL"
        )
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        throw new Error()
    }
}
