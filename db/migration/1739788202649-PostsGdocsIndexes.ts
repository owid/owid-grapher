import { MigrationInterface, QueryRunner } from "typeorm"

export class PostsGdocsIndexes1739788202649 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Change `type` col def from `VIRTUAL` to `STORED`
        await queryRunner.query(`-- sql
            ALTER TABLE posts_gdocs
            DROP INDEX idx_posts_gdocs_type,
            DROP COLUMN type,
            ADD COLUMN type VARCHAR(255) GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(content, '$.type'))) STORED AFTER slug
        `)

        await queryRunner.query(`-- sql
            ALTER TABLE posts_gdocs
            ADD INDEX idx_posts_gdocs_published (published)
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            DROP INDEX idx_posts_gdocs_published ON posts_gdocs
        `)

        await queryRunner.query(`-- sql
            ALTER TABLE posts_gdocs
            DROP COLUMN type,
            ADD COLUMN type VARCHAR(255) GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(content, '$.type'))) VIRTUAL AFTER slug,
            ADD INDEX idx_posts_gdocs_type (type)
        `)
    }
}
