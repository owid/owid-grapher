import { MigrationInterface, QueryRunner } from "typeorm"

export class AddErrorHandlingToExplorerViews1753223931142
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add error column to store failure messages
        await queryRunner.query(`
            ALTER TABLE explorer_views
            ADD COLUMN error TEXT NULL
        `)

        // Make chartConfigId nullable to allow views without valid configs
        await queryRunner.query(`
            ALTER TABLE explorer_views
            MODIFY COLUMN chartConfigId CHAR(36) NULL
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove error column
        await queryRunner.query(`
            ALTER TABLE explorer_views
            DROP COLUMN error
        `)

        // Make chartConfigId non-nullable again (first remove any rows with NULL values)
        await queryRunner.query(`
            DELETE FROM explorer_views WHERE chartConfigId IS NULL
        `)
        await queryRunner.query(`
            ALTER TABLE explorer_views
            MODIFY COLUMN chartConfigId CHAR(36) NOT NULL
        `)
    }
}
