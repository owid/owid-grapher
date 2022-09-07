import { MigrationInterface, QueryRunner } from "typeorm"

export class AddGoogleDocsPostTable1659996181316 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`posts_gdocs\` (
            \`id\` varchar(255) NOT NULL,
            \`slug\` varchar(255) DEFAULT NULL,
            \`content\` json DEFAULT NULL,
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
