import { MigrationInterface, QueryRunner } from "typeorm"

export class MakeDonorsCommentNotNull1793123626614 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            UPDATE donors SET comment = '' WHERE comment IS NULL
        `)
        await queryRunner.query(`-- sql
            ALTER TABLE donors
            MODIFY comment TEXT NOT NULL DEFAULT ('')
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE donors
            MODIFY comment TEXT NULL DEFAULT ('')
        `)
    }
}
