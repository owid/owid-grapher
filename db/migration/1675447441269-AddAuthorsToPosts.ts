import { MigrationInterface, QueryRunner } from "typeorm"

export class AddAuthorsToPosts1675447441269 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE posts
        ADD COLUMN authors JSON comment 'json array of strings in the form "firstname lastname"'
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE posts
        DROP COLUMN authors
        `)
    }
}
