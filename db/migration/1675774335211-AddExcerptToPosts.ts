import { MigrationInterface, QueryRunner } from "typeorm"

export class AddExcerptToPosts1675774335211 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE posts
        ADD COLUMN excerpt text
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE posts
        DROP COLUMN excerpt
        `)
    }
}
