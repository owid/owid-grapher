/* eslint-disable @typescript-eslint/no-empty-function */
import { MigrationInterface, QueryRunner } from "typeorm"

export class RemoveDatasetFilesTable1743576697066
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS dataset_files`)
    }

    public async down(): Promise<void> {}
}
