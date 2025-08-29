import { MigrationInterface, QueryRunner } from "typeorm"

export class AddSessionUserForeignKey1756391135333
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE sessions
            ADD COLUMN user_id INT AFTER session_key,
            ADD FOREIGN KEY (user_id) REFERENCES users(id)
            ON DELETE CASCADE ON UPDATE RESTRICT
        `)

        // The substring_index calls extract the email address out of the base64-encoded
        // and concatenated session_data string, such that we can join on the users table
        await queryRunner.query(`
            WITH sessions_with_emails AS (
                SELECT session_key,
                SUBSTRING_INDEX(
                    SUBSTRING_INDEX(from_base64(session_data), '":"', -1),
                    '"}',
                    1) AS email
                FROM sessions)
            UPDATE sessions s
            JOIN sessions_with_emails swe ON swe.session_key = s.session_key
            SET s.user_id = (SELECT id FROM users WHERE email = swe.email)
        `)

        await queryRunner.query(`
            ALTER TABLE sessions
            MODIFY COLUMN user_id INT NOT NULL,
            DROP COLUMN session_data
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE sessions
            DROP COLUMN user_id,
            ADD COLUMN session_data longtext not null
        `)
    }
}
