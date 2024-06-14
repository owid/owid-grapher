import { MigrationInterface, QueryRunner } from "typeorm"

export class AddGdocsPostsSlugIndex1718371124648 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE posts_gdocs ADD INDEX idx_posts_gdocs_slug (slug(100));
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            DROP INDEX idx_posts_gdocs_slug ON posts_gdocs;
        `)
    }
}
