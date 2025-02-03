import { MigrationInterface, QueryRunner } from "typeorm"

export class AlterVariablesIndexes1738574434234 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop the unique index on (shortName ,datasetId)
        await queryRunner.query(`
            ALTER TABLE variables
            DROP INDEX unique_short_name_per_dataset;
        `)

        // Drop the unique index on (name, datasetId)
        await queryRunner.query(`
            ALTER TABLE variables
            DROP INDEX variables_name_fk_dst_id_f7453c33_uniq;
        `)

        // Recreate a non-unique index on (name, datasetId)
        await queryRunner.query(`
            ALTER TABLE variables
            ADD INDEX idx_name_dataset (name, datasetId);
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop the non-unique index on (name, datasetId)
        await queryRunner.query(`
            ALTER TABLE variables
            DROP INDEX idx_name_dataset;
        `)

        // Recreate the unique index on (name, datasetId)
        await queryRunner.query(`
            ALTER TABLE variables
            ADD UNIQUE INDEX variables_name_fk_dst_id_f7453c33_uniq (name, datasetId);
        `)

        // Recreate the unique index on (shortName, datasetId)
        await queryRunner.query(`
            ALTER TABLE variables
            ADD UNIQUE INDEX unique_short_name_per_dataset (shortName, datasetId);
        `)
    }
}
