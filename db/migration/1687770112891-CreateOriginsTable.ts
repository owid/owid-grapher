import { MigrationInterface, QueryRunner } from "typeorm"

export class CreateOriginsTable1687770112891 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
        CREATE TABLE origins (
            id INT AUTO_INCREMENT PRIMARY KEY,
            datasetTitleOwid VARCHAR(512),
            datasetTitleProducer VARCHAR(512),
            datasetDescriptionOwid TEXT,
            datasetDescriptionProducer TEXT,
            producer VARCHAR(255),
            citationProducer TEXT,
            datasetUrlMain TEXT,
            datasetUrlDownload TEXT,
            dateAccessed DATE,
            datePublished VARCHAR(10)
        );
        `)

        // create index on datasetTitleOwid for faster lookups
        // ideally we'd have unique index on all columns, but we'd be over 3072 bytes limit
        await queryRunner.query(`-- sql
        CREATE INDEX idx_datasetTitleOwid ON origins(datasetTitleOwid);`)

        await queryRunner.query(`-- sql
        CREATE TABLE origins_variables (
            originId INT,
            variableId INT,
            PRIMARY KEY (originId, variableId),
            FOREIGN KEY (originId) REFERENCES origins(id),
            FOREIGN KEY (variableId) REFERENCES variables(id)
        );
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
        DROP TABLE IF EXISTS origins_variables;
        `)
        await queryRunner.query(`-- sql
        DROP TABLE IF EXISTS origins;
        `)
    }
}
