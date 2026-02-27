import { MigrationInterface, QueryRunner } from "typeorm"

export class AddPresentationToVariables1688372371221 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `-- sql
            ALTER TABLE variables
                ADD COLUMN schemaVersion INT NOT NULL DEFAULT 1,
                ADD COLUMN processingLevel VARCHAR(30),
                ADD COLUMN processingLog JSON,
                ADD COLUMN titlePublic VARCHAR(512),
                ADD COLUMN titleVariant VARCHAR(255),
                ADD COLUMN producerShort VARCHAR(512),
                ADD COLUMN citationInline TEXT,
                ADD COLUMN descriptionShort TEXT,
                ADD COLUMN descriptionFromProducer TEXT,
                ADD COLUMN keyInfoText JSON,
                ADD COLUMN processingInfo TEXT,
                ADD COLUMN licenses JSON,
                ADD COLUMN presentationLicense JSON,
                ADD COLUMN grapherConfigETL JSON;`
        )
        await queryRunner.query(
            `ALTER TABLE datasets
                ADD COLUMN updatePeriodDays INT;`
        )

        // make variables.souceId nullable
        await queryRunner.query(
            `ALTER TABLE variables MODIFY sourceId int NULL;`
        )

        // rename grapherConfig to grapherConfigAdmin
        await queryRunner.query(
            `ALTER TABLE variables RENAME COLUMN grapherConfig TO grapherConfigAdmin;`
        )

        // The collation here is probably an artifact of a wrong default collation that we had
        // on dev servers until July 2023. Starting from scratch with a prod database this
        // the collation here should be automatic but it also doesn't hurt to specify it.
        await queryRunner.query(`
        CREATE TABLE posts_gdocs_variables_faqs (
            gdocId varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs NOT NULL,
            variableId INT NOT NULL,
            fragmentId VARCHAR(255) NOT NULL,
            PRIMARY KEY (gdocId, fragmentId, variableId),
            FOREIGN KEY (gdocId) REFERENCES posts_gdocs(id),
            FOREIGN KEY (variableId) REFERENCES variables(id)
        )`)

        await queryRunner.query(`
        CREATE TABLE tags_variables_topic_tags (
            tagId INT NOT NULL,
            variableId INT NOT NULL,
            PRIMARY KEY (tagId, variableId),
            FOREIGN KEY (tagId) REFERENCES tags(id),
            FOREIGN KEY (variableId) REFERENCES variables(id)
        )`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
        DROP TABLE IF EXISTS posts_gdocs_variables_faqs;`)

        await queryRunner.query(`
        DROP TABLE IF EXISTS tags_variables_topic_tags;`)

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
                DROP COLUMN keyInfoText,
                DROP COLUMN processingInfo,
                DROP COLUMN licenses,
                DROP COLUMN presentationLicense,
                DROP COLUMN grapherConfigETL;
            `
        )

        await queryRunner.query(
            `ALTER TABLE datasets
                DROP COLUMN updatePeriodDays;
            `
        )

        await queryRunner.query(
            `ALTER TABLE variables RENAME COLUMN grapherConfigAdmin TO grapherConfig;`
        )

        await queryRunner.query(
            `ALTER TABLE variables MODIFY sourceId int NOT NULL;`
        )
    }
}
