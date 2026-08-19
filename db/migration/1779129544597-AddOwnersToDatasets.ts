import { MigrationInterface, QueryRunner } from "typeorm"

export class AddOwnersToDatasets1779129544597 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // List of OWID team members who maintain each dataset; first entry is
        // the accountable owner. Populated from ETL via DatasetMeta.owners.
        await queryRunner.query(
            "ALTER TABLE `datasets` ADD COLUMN `owners` JSON NULL DEFAULT NULL"
        )
        // The active_datasets view is defined as `SELECT *`, which MySQL
        // freezes into an explicit column list at creation time, so it must be
        // recreated to expose the new column.
        await queryRunner.query(
            "ALTER VIEW active_datasets AS SELECT * FROM datasets WHERE not isArchived"
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop the column first, then recreate the view so its frozen column
        // list no longer references `owners`.
        await queryRunner.query("ALTER TABLE `datasets` DROP COLUMN `owners`")
        await queryRunner.query(
            "ALTER VIEW active_datasets AS SELECT * FROM datasets WHERE not isArchived"
        )
    }
}
