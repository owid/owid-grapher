import { MigrationInterface, QueryRunner } from "typeorm"

export class DetailsOnDemand1653584089031 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
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

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE details`)
    }
}
