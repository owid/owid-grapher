import { MigrationInterface, QueryRunner } from "typeorm"

export class AddChartConfigHash1722415645057 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // alter the chart_configs table and add a column for a sha-1 has of the full config
        await queryRunner.query(`
            ALTER TABLE chart_configs
            ADD COLUMN fullSha1Base64 CHAR(28);
        `)

        await queryRunner.query(`
            UPDATE chart_configs
            SET fullSha1Base64 = to_base64(unhex(SHA1(full)))
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE chart_configs
            DROP COLUMN fullSha1Base64;
        `)
    }
}
