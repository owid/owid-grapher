import { MigrationInterface, QueryRunner } from "typeorm"

export class RemoveIsExplorableColumnFromCharts1709913303952
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        queryRunner.query(`ALTER TABLE charts DROP COLUMN isExplorable;`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        queryRunner.query(
            `ALTER TABLE charts ADD COLUMN isExplorable tinyint(1) NOT NULL DEFAULT '0';`
        )
    }
}
