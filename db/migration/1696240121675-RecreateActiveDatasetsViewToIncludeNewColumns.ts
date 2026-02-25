import { MigrationInterface, QueryRunner } from "typeorm"

export class RecreateActiveDatasetsViewToIncludeNewColumns1696240121675 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
        ALTER VIEW active_datasets AS SELECT * FROM datasets WHERE not isArchived;
      `)
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        // Empty
    }
}
