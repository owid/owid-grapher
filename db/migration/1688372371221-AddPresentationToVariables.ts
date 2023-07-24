import { MigrationInterface, QueryRunner } from "typeorm"

export class AddPresentationToVariables1688372371221
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE variables
                ADD COLUMN schemaVersion INT,
                ADD COLUMN processingLevel ENUM('minor', 'medium', 'major'),
                ADD COLUMN processingLog JSON,
                ADD COLUMN titlePublic TEXT,
                ADD COLUMN titleVariant TEXT,
                ADD COLUMN producerShort TEXT,
                ADD COLUMN citationInline TEXT,
                ADD COLUMN descriptionShort TEXT,
                ADD COLUMN descriptionFromProducer TEXT,
                -- ADD COLUMN topicTagsLinks JSON,
                ADD COLUMN keyInfoText TEXT,
                ADD COLUMN processingInfo TEXT,
                ADD COLUMN licenses JSON;`
        )
        await queryRunner.query(`
        CREATE TABLE posts_gdocs_variables_faqs (
            gdocId varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL,
            variableId INT NOT NULL,
            fragmentId VARCHAR(255) NOT NULL,
            PRIMARY KEY (gdocId, fragmentId, variableId),
            FOREIGN KEY (gdocId) REFERENCES posts_gdocs(id),
            FOREIGN KEY (variableId) REFERENCES variables(id)
        )`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
        DROP TABLE IF EXISTS posts_gdocs_variables_faqs;`)

        await queryRunner.query(
            `ALTER TABLE variables
                DROP COLUMN schemaVersion,
                DROP COLUMN processingLevel,
                DROP COLUMN processingLog,
                DROP COLUMN titlePublic,
                DROP COLUMN titleVariant,
                DROP COLUMN producerShort,
                DROP COLUMN citationInline,
                DROP COLUMN descriptionShort,
                DROP COLUMN descriptionFromProducer,
                -- DROP COLUMN topicTagsLinks,
                DROP COLUMN keyInfoText,
                DROP COLUMN processingInfo,
                DROP COLUMN licenses;
            `
        )
    }
}
