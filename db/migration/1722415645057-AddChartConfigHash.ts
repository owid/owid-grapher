import { MigrationInterface, QueryRunner } from "typeorm"

export class AddChartConfigHash1722415645057 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE chart_configs
            ADD COLUMN fullMd5 CHAR(24);
        `)

        await queryRunner.query(`
            UPDATE chart_configs
            SET fullMd5 = to_base64(unhex(md5(full)))
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE chart_configs
            DROP COLUMN fullMd5;
        `)
    }
}
