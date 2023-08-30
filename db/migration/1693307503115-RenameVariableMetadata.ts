import { MigrationInterface, QueryRunner } from "typeorm"

export class RenameVariableMetadata1693307503115 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE variables
            RENAME COLUMN keyInfoText TO descriptionKey,
            RENAME COLUMN processingInfo TO descriptionProcessing;
        `)

        await queryRunner.query(`
            ALTER TABLE origins
            RENAME COLUMN version TO versionProducer;
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE variables
            RENAME COLUMN descriptionKey TO keyInfoText,
            RENAME COLUMN descriptionProcessing TO processingInfo;
        `)

        await queryRunner.query(`
            ALTER TABLE origins
            RENAME COLUMN versionProducer TO version;
        `)
    }
}
