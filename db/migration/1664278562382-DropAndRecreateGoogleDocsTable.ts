import { MigrationInterface, QueryRunner } from "typeorm"

export class DropAndRecreateGoogleDocsTable1664278562382
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        // by the time this migration is run, the posts_gdocs table has already been
        // created but should not hold any data. So we can just drop it and
        // recreate it.
        await queryRunner.query(`DROP TABLE IF EXISTS \`posts_gdocs\``)
        await queryRunner.query(`CREATE TABLE \`posts_gdocs\` (
            \`id\` varchar(255) NOT NULL,
            \`slug\` varchar(255) NOT NULL,
            \`title\` varchar(255) NOT NULL,
            \`content\` json NOT NULL,
            \`published\` tinyint DEFAULT 0 NOT NULL,
            \`createdAt\` datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
            \`updatedAt\` datetime NULL ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (\`id\`),
            UNIQUE(\`slug\`)
        )`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE posts_gdocs`)
    }
}
