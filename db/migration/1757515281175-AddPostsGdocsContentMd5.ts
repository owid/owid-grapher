import { MigrationInterface, QueryRunner } from "typeorm"

export class AddPostsGdocsContentMd51757515281175 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE posts_gdocs
            ADD COLUMN contentMd5 CHAR(24) GENERATED ALWAYS AS (to_base64(unhex(md5(content)))) STORED NOT NULL AFTER content
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE posts_gdocs
            DROP COLUMN contentMd5
        `)
    }
}
