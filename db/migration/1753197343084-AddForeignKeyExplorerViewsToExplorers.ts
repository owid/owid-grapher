import { MigrationInterface, QueryRunner } from "typeorm"

export class AddForeignKeyExplorerViewsToExplorers1753197343084
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add foreign key constraint from explorer_views.explorerSlug to explorers.slug
        await queryRunner.query(`-- sql
            ALTER TABLE explorer_views
            ADD CONSTRAINT fk_explorer_views_explorer_slug
            FOREIGN KEY (explorerSlug) REFERENCES explorers(slug)
            ON UPDATE CASCADE ON DELETE CASCADE
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop the foreign key constraint
        await queryRunner.query(`-- sql
            ALTER TABLE explorer_views
            DROP FOREIGN KEY fk_explorer_views_explorer_slug
        `)
    }
}
