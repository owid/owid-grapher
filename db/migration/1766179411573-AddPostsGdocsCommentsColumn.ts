import { MigrationInterface, QueryRunner } from "typeorm"

export class AddPostsGdocsCommentsColumn1766179411573
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE posts_gdocs
            ADD COLUMN comments JSON DEFAULT NULL
            COMMENT 'Google Docs comments fetched via Drive API, stored as JSON'
            AFTER markdown
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE posts_gdocs
            DROP COLUMN comments
        `)
    }
}

