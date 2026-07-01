import { MigrationInterface, QueryRunner } from "typeorm"

export class AddChartSlugRedirectTargetQueryParam1782901735673 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE chart_slug_redirects
            ADD COLUMN target_query_param VARCHAR(2047) NULL AFTER chart_id
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE chart_slug_redirects
            DROP COLUMN target_query_param
        `)
    }
}
