import { MigrationInterface, QueryRunner } from "typeorm"

export class AddVirtualGdocsTypeColumn1712843782834
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
        ALTER TABLE posts_gdocs
        ADD COLUMN type VARCHAR(255) GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(content, '$.type'))) VIRTUAL AFTER slug;`)

        await queryRunner.query(`-- sql
        CREATE INDEX idx_posts_gdocs_type ON posts_gdocs (type);`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
        DROP INDEX idx_posts_gdocs_type ON posts_gdocs;`)

        await queryRunner.query(`-- sql
        ALTER TABLE posts_gdocs
        DROP COLUMN type;`)
    }
}
