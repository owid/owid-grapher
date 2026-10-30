import { MigrationInterface, QueryRunner } from "typeorm"

export class AddAgentServiceAccount1787230800000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // When the agent answers a comment, the reply needs an author:
        // comments.userId is not nullable, and replying as the person who asked
        // would read as them talking to themselves. This account exists only to
        // own those replies.
        //
        // isActive = 0 means it cannot sign in - authentication is external, and
        // there is no password to hold - so it grants nothing. The .invalid
        // domain is reserved by RFC 2606 and can never route mail, so this can't
        // collide with a real mailbox.
        //
        // It also serves as the marker that stops a reply being treated as a new
        // request: nothing this account writes is ever acted on.
        await queryRunner.query(`-- sql
            INSERT INTO users (email, fullName, isActive, isSuperuser)
            VALUES ('claude-agent@owid.invalid', 'Claude', 0, 0)
            ON DUPLICATE KEY UPDATE fullName = VALUES(fullName)
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Comments authored by the account would lose their author, so only
        // remove it once nothing references it.
        await queryRunner.query(`-- sql
            DELETE u FROM users u
            LEFT JOIN comments c ON c.userId = u.id
            WHERE u.email = 'claude-agent@owid.invalid' AND c.id IS NULL
        `)
    }
}
