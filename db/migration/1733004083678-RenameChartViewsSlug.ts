import { MigrationInterface, QueryRunner } from "typeorm"

export class RenameChartViewsSlug1733004083678 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `-- sql
            ALTER TABLE chart_views RENAME COLUMN slug TO name, RENAME INDEX slug TO name;
            `
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `-- sql
            ALTER TABLE chart_views RENAME COLUMN name TO slug, RENAME INDEX name TO slug;
            `
        )
    }
}
