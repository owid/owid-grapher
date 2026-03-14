import { MigrationInterface, QueryRunner } from "typeorm"

export class AddExtractedTextToImages1772811035129 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE images
            ADD COLUMN extractedText TEXT NULL AFTER defaultAlt
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE images
            DROP COLUMN extractedText
        `)
    }
}
