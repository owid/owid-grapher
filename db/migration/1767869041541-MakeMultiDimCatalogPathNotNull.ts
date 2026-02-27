import { MigrationInterface, QueryRunner } from "typeorm"

export class MakeMultiDimCatalogPathNotNull1767869041541 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `-- sql
            ALTER TABLE multi_dim_data_pages
            MODIFY COLUMN catalogPath VARCHAR(767) NOT NULL`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `-- sql
            ALTER TABLE multi_dim_data_pages
            MODIFY COLUMN catalogPath VARCHAR(767) NULL`
        )
    }
}
