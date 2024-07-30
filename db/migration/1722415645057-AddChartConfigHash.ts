import { MigrationInterface, QueryRunner } from "typeorm"

export class AddChartConfigHash1722415645057 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE chart_configs
            ADD COLUMN fullMd5 CHAR(24) GENERATED ALWAYS as (to_base64(unhex(md5(full)))) STORED NOT NULL;
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE chart_configs
            DROP COLUMN fullMd5;
        `)
    }
}
