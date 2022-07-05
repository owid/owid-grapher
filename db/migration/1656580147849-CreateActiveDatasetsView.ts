import { MigrationInterface, QueryRunner } from "typeorm"

export class CreateActiveDatasetsView1656580147849
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
        CREATE VIEW active_datasets AS SELECT * FROM datasets WHERE not isArchived;
      `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
        DROP VIEW active_datasets;
      `)
    }
}
