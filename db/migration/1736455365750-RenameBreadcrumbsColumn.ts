import { MigrationInterface, QueryRunner } from "typeorm"

export class RenameBreadcrumbsColumn1736455365750
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE posts_gdocs RENAME COLUMN breadcrumbs TO manualBreadcrumbs`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE posts_gdocs RENAME COLUMN manualBreadcrumbs TO breadcrumbs`)
    }
}
