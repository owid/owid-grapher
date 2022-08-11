import { MigrationInterface, QueryRunner } from "typeorm"

export class DropInvitations1659542205339 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // remove unused table
        await queryRunner.query(`
            DROP TABLE user_invitations;
        `)
        // drop not-null constraint from password field (we log in with G Suite)
        await queryRunner.query(`
            ALTER TABLE users MODIFY COLUMN password VARCHAR(128);
        `)
    }

    public async down(): Promise<void> {
        // We'll write it if we need it, right?
    }
}
