import { MigrationInterface, QueryRunner } from "typeorm"

export class AddContextToPostsGdocsXImages1776165276305 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE posts_gdocs_x_images
            ADD COLUMN context ENUM('content', 'article-thumbnail') NOT NULL DEFAULT 'content'
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE posts_gdocs_x_images
            DROP COLUMN context
        `)
    }
}
