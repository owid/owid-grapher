import { MigrationInterface, QueryRunner } from "typeorm"

export class AddListedToPosts1706263030308 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE posts ADD COLUMN isListed BOOLEAN NOT NULL DEFAULT FALSE;
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE posts DROP COLUMN isListed;
        `)
    }
}
