import { MigrationInterface, QueryRunner } from "typeorm"

/**
 * `variables.grapherConfigId{ETL,Admin}` become `patchConfigId{ETL,Admin}`: they
 * point at authored layers, and that is what `patchConfigId` names everywhere else
 * in the schema, while `configId`/`chartConfigId` names a resolved config.
 */
export class RenameChartConfigForeignKeys1786455779158 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE variables
            RENAME COLUMN grapherConfigIdETL TO patchConfigIdETL,
            RENAME COLUMN grapherConfigIdAdmin TO patchConfigIdAdmin,
            RENAME INDEX grapherConfigIdETL TO patchConfigIdETL,
            RENAME INDEX grapherConfigIdAdmin TO patchConfigIdAdmin
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE variables
            RENAME COLUMN patchConfigIdETL TO grapherConfigIdETL,
            RENAME COLUMN patchConfigIdAdmin TO grapherConfigIdAdmin,
            RENAME INDEX patchConfigIdETL TO grapherConfigIdETL,
            RENAME INDEX patchConfigIdAdmin TO grapherConfigIdAdmin
        `)
    }
}
