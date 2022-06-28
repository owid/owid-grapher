import { MigrationInterface, QueryRunner } from "typeorm"

export class KeyCharts1656406573545 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
        ALTER TABLE chart_tags
        ADD isKey TINYINT UNSIGNED;
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
        ALTER TABLE chart_tags
        DROP isKey;
        `)
    }
}
