import { MigrationInterface, QueryRunner } from "typeorm"

export class RenameVariableMetadataV21694509192714 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE variables
            RENAME COLUMN producerShort TO attributionShort;
        `)

        await queryRunner.query(`
            ALTER TABLE origins
            RENAME COLUMN datasetUrlMain TO urlMain,
            RENAME COLUMN datasetUrlDownload TO urlDownload,
            RENAME COLUMN datasetTitleProducer TO title,
            RENAME COLUMN datasetDescriptionProducer TO description,
            RENAME COLUMN datasetTitleOwid TO titleSnapshot,
            RENAME COLUMN datasetDescriptionOwid TO descriptionSnapshot,
            RENAME COLUMN citationProducer TO citationFull;
        `)

        await queryRunner.query(`
            DROP INDEX idx_datasetTitleOwid ON origins;
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE variables
            RENAME COLUMN attributionShort TO producerShort;
        `)

        await queryRunner.query(`
            ALTER TABLE origins
            RENAME COLUMN urlMain TO datasetUrlMain,
            RENAME COLUMN urlDownload TO datasetUrlDownload,
            RENAME COLUMN title TO datasetTitleProducer,
            RENAME COLUMN description TO datasetDescriptionProducer,
            RENAME COLUMN titleSnapshot TO datasetTitleOwid,
            RENAME COLUMN descriptionSnapshot TO datasetDescriptionOwid,
            RENAME COLUMN citationFull TO citationProducer;
        `)

        await queryRunner.query(`-- sql
            CREATE INDEX idx_datasetTitleOwid ON origins(datasetTitleOwid);`)
    }
}
