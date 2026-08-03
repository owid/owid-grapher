import { MigrationInterface, QueryRunner } from "typeorm"

export class AddDeprecationNoticeToCharts1785758651711 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE charts
            ADD COLUMN deprecationNotice TEXT NULL AFTER forceDatapage
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE charts
            DROP COLUMN deprecationNotice
        `)
    }
}
