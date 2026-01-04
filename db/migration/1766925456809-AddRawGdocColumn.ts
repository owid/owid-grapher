import { MigrationInterface, QueryRunner } from "typeorm"

export class AddRawGdocColumn1766925456809 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE posts_gdocs
            ADD COLUMN rawGdoc JSON DEFAULT NULL AFTER revisionId
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE posts_gdocs
            DROP COLUMN rawGdoc
        `)
    }
}
