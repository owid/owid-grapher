import { MigrationInterface, QueryRunner } from "typeorm"
import { ChartCalloutValuesTableName } from "@ourworldindata/types"

export class ChartCalloutValues1766172604964 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            CREATE TABLE ${ChartCalloutValuesTableName} (
                id VARCHAR(255) PRIMARY KEY,
                value JSON NOT NULL,
                createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updatedAt DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
            );
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            DROP TABLE IF EXISTS ${ChartCalloutValuesTableName};
        `)
    }
}
