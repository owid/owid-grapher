import { MigrationInterface, QueryRunner } from "typeorm"

export class AddCreatedAtToPosts1676470290267 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE posts
        ADD COLUMN created_at_in_wordpress datetime
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE posts
        DROP COLUMN created_at_in_wordpress
        `)
    }
}
