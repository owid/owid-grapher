import { MigrationInterface, QueryRunner } from "typeorm"

export class AddOwnersToDatasets1779129544597 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // List of OWID team members who maintain each dataset; first entry is
        // the accountable owner. Populated from ETL via DatasetMeta.owners.
        await queryRunner.query(
            "ALTER TABLE `datasets` ADD COLUMN `owners` JSON NULL DEFAULT NULL"
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query("ALTER TABLE `datasets` DROP COLUMN `owners`")
    }
}
