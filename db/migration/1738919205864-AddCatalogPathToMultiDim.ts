import { MigrationInterface, QueryRunner } from "typeorm"

export class AddCatalogPathToMultiDim1738919205864
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `-- sql
            ALTER TABLE multi_dim_data_pages
            MODIFY COLUMN slug VARCHAR(255) NULL,
            ADD COLUMN catalogPath VARCHAR(767) NULL AFTER id,
            ADD UNIQUE INDEX idx_multi_dim_data_pages_catalog_path (catalogPath)`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `-- sql
            ALTER TABLE multi_dim_data_pages
            MODIFY COLUMN slug VARCHAR(255) NOT NULL,
            DROP COLUMN catalogPath`
        )
    }
}
