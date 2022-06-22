import { MigrationInterface, QueryRunner } from "typeorm"

export class AddIsArchivedToDatasets1653646292627
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
          ALTER TABLE datasets ADD COLUMN isArchived BOOLEAN NOT NULL DEFAULT FALSE;
      `)
    }

    public async down(): Promise<void> {}
}
