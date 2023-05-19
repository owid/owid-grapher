import { MigrationInterface, QueryRunner } from "typeorm"

export class MigrationName1684497673011 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE suggested_chart_revisions
              ADD COLUMN experimental JSON;
            `
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE suggested_chart_revisions
              DROP COLUMN experimental;
            `
        )
    }
}
