import { MigrationInterface, QueryRunner } from "typeorm"

export class PostsFeaturedImage1685653967284 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
        ALTER TABLE posts
        ADD COLUMN featured_image VARCHAR(1024) NOT NULL DEFAULT "";
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
        ALTER TABLE posts
        DROP COLUMN featured_image;
        `)
    }
}
