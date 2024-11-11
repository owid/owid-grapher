import { MigrationInterface, QueryRunner } from "typeorm"

export class AddGithubUsernameToUsers1731317168994
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add 'githubUsername' column using raw SQL
        await queryRunner.query(`
            ALTER TABLE users ADD COLUMN githubUsername VARCHAR(255) NULL;
        `)

        // Set 'githubUsername' = 'fullName' by default
        await queryRunner.query(`
            UPDATE users
            SET githubUsername = fullName;
        `)

        // Update 'githubUsername' for specific users
        await queryRunner.query(`
            UPDATE users
            SET githubUsername = 'Tuna' WHERE fullName = 'Tuna Acisu';
            UPDATE users
            SET githubUsername = 'bastianherre' WHERE fullName = 'Bastian Herre';
            UPDATE users
            SET githubUsername = 'JoeHasell' WHERE fullName = 'Joe Hasell';
            UPDATE users
            SET githubUsername = 'mrwbkrm' WHERE fullName = 'Marwa Boukarim';
            UPDATE users
            SET githubUsername = 'veronikasamborska1994' WHERE fullName = 'Veronika Samborska';
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove 'githubUsername' column using raw SQL
        await queryRunner.query(`
            ALTER TABLE users DROP COLUMN githubUsername;
        `)
    }
}
