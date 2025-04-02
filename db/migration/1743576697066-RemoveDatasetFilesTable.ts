import { MigrationInterface, QueryRunner } from "typeorm"

export class RemoveDatasetFilesTable1743576697066
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS dataset_files`)
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {}
}
