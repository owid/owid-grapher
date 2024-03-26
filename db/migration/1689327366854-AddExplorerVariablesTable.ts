import { MigrationInterface, QueryRunner } from "typeorm"

export class AddExplorerVariablesTable1689327366854
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
          CREATE TABLE \`explorer_variables\` (
            \`id\` int NOT NULL AUTO_INCREMENT,
            \`explorerSlug\` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL,
            \`variableId\` int NOT NULL,
            PRIMARY KEY (\`id\`),
            KEY \`explorerSlug\` (\`explorerSlug\`),
            KEY \`variableId\` (\`variableId\`),
            CONSTRAINT \`explorer_variables_ibfk_1\` FOREIGN KEY (\`explorerSlug\`) REFERENCES \`explorers\` (\`slug\`) ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT \`explorer_variables_ibfk_2\` FOREIGN KEY (\`variableId\`) REFERENCES \`variables\` (\`id\`) ON DELETE RESTRICT ON UPDATE RESTRICT
          )`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE explorer_variables`)
    }
}
