import { MigrationInterface, QueryRunner } from "typeorm"

export class AddColumnViews365toPageviews1684842968906 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE pageviews
              ADD COLUMN views_365d INT UNSIGNED NOT NULL;
            `
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE pageviews
              DROP COLUMN views_365d;
            `
        )
    }
}
