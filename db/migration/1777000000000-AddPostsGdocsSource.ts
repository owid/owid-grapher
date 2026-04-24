import { MigrationInterface, QueryRunner } from "typeorm"

export class AddPostsGdocsSource1777000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE posts_gdocs
            ADD COLUMN source ENUM('gdocs', 'file') NOT NULL DEFAULT 'gdocs'
            AFTER revisionId
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE posts_gdocs DROP COLUMN source
        `)
    }
}
