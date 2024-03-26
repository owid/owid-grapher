import { MigrationInterface, QueryRunner } from "typeorm"

export class GdocsAddBreadcrumbsColumn1687851686136
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE posts_gdocs ADD COLUMN breadcrumbs JSON`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE posts_gdocs DROP COLUMN breadcrumbs`)
    }
}
