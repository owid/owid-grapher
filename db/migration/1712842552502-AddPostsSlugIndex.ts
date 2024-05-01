import { MigrationInterface, QueryRunner } from "typeorm"

export class AddPostsSlugIndex1712842552502 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE posts ADD INDEX idx_posts_slug (slug(100));
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            DROP INDEX idx_posts_slug ON posts;
        `)
    }
}
