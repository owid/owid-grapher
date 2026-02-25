import { MigrationInterface, QueryRunner } from "typeorm"

export class AddIsIsApprovedToChartTags1694348415243 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
        ALTER TABLE chart_tags
        ADD COLUMN isApproved TINYINT(1) NOT NULL DEFAULT 0;
        `)
        await queryRunner.query(`
        UPDATE chart_tags SET isApproved = 1;
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE chart_tags
            DROP COLUMN isApproved;
        `)
    }
}
