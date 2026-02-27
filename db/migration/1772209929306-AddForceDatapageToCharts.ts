import { MigrationInterface, QueryRunner } from "typeorm"

export class AddForceDatapageToCharts1772209929306
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE charts
            ADD COLUMN forceDatapage TINYINT(1) NOT NULL DEFAULT 0
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE charts
            DROP COLUMN forceDatapage
        `)
    }
}
