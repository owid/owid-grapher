import { MigrationInterface, QueryRunner } from "typeorm"

export class AddUpdatedAtInWordpressToPosts1676042584151 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE posts
        ADD COLUMN updated_at_in_wordpress datetime
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE posts
        DROP COLUMN updated_at_in_wordpress
        `)
    }
}
