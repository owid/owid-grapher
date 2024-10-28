import { MigrationInterface, QueryRunner } from "typeorm"

export class AddMultiDimIdConfigMd5SlugIndex1729600015045
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE multi_dim_data_pages
            DROP PRIMARY KEY,
            ADD COLUMN id SERIAL PRIMARY KEY FIRST,
            ADD COLUMN configMd5 CHAR(24) GENERATED ALWAYS as (to_base64(unhex(md5(config)))) STORED NOT NULL AFTER config
        `)
        await queryRunner.query(`-- sql
            CREATE UNIQUE INDEX idx_multi_dim_data_pages_slug
            ON multi_dim_data_pages (slug)
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            DROP INDEX idx_multi_dim_data_pages_slug ON multi_dim_data_pages
        `)
        await queryRunner.query(`-- sql
            ALTER TABLE multi_dim_data_pages
            DROP COLUMN id,
            DROP COLUMN configMd5,
            ADD PRIMARY KEY (slug)
        `)
    }
}
