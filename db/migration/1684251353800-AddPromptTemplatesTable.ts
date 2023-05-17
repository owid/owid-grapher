import { MigrationInterface, QueryRunner } from "typeorm"

export class AddPromptTemplatesTable1684251353800
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
        CREATE TABLE prompt_templates (
            id int NOT NULL AUTO_INCREMENT,
            name varchar(250) COLLATE utf8mb4_0900_as_cs NOT NULL UNIQUE,
            prompt text COLLATE utf8mb4_0900_as_cs NOT NULL,
            createdAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updatedAt datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
            lastEditedByUserId int NOT NULL,
            PRIMARY KEY (id),
            CONSTRAINT prompt_templates_lastEditedByUserId FOREIGN KEY (lastEditedByUserId) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT
        )`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE prompt_templates`)
    }
}
