import { MigrationInterface, QueryRunner } from "typeorm"

export class AddShortNameToVariables1659011791860
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE variables
            ADD COLUMN shortName VARCHAR(255)
            DEFAULT NULL;
        `)
        await queryRunner.query(`
            ALTER TABLE variables ADD CONSTRAINT unique_short_name_per_dataset (shortName, datasetId);
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE variables
            DROP INDEX unique_short_name_per_dataset
        `)
        await queryRunner.query(`
            ALTER TABLE variables
            DROP COLUMN shortName;
        `)
    }
}
