import { MigrationInterface, QueryRunner } from "typeorm"

export class CreateMultiDimTable1724249694337 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            CREATE TABLE multi_dim_data_pages
            (
                slug      VARCHAR(255)      NOT NULL PRIMARY KEY,
                config    JSON              NOT NULL,
                published TINYINT DEFAULT 0 NOT NULL,
                createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            DROP TABLE multi_dim_data_pages
        `)
    }
}
