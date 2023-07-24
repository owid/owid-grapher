import { MigrationInterface, QueryRunner } from "typeorm"

export class AddPresentationToVariables1688372371221
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE variables
              ADD COLUMN schemaVersion int,
              ADD COLUMN processingLevel varchar(255),
              ADD COLUMN presentation JSON;
            `
        )

        await queryRunner.query(
            `ALTER TABLE variables
            ADD CONSTRAINT processing_level_check
            CHECK (processingLevel IN ('minor', 'medium', 'major'));
            `
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE variables
              DROP COLUMN schemaVersion,
              DROP COLUMN processingLevel,
              DROP COLUMN presentation;
            `
        )
    }
}
