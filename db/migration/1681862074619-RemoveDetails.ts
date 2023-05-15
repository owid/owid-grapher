import { MigrationInterface, QueryRunner } from "typeorm"

export class RemoveDetails1681862074619 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        queryRunner.query(`
            DROP TABLE IF EXISTS details
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`details\` (
            \`id\` int NOT NULL AUTO_INCREMENT,
            \`category\` varchar(255) NOT NULL,
            \`term\` varchar(255) NOT NULL,
            \`title\` varchar(255) NOT NULL,
            \`content\` varchar(1023) NOT NULL,
            PRIMARY KEY (\`id\`),
            UNIQUE(\`category\`, \`term\`)
        )`)
    }
}
