import { MigrationInterface, QueryRunner } from "typeorm"

// DEBUG, DO NOT MERGE. Marks energy-mix as a data explorer with an explorer
// subtitle, so the mdim stack's data-explorer features (the "Data explorer"
// eyebrow, the /explorers card, the homepage count and the title in external
// embeds) can be checked on staging before ETL emits `presentation.pageType`.
export class DebugMarkEnergyMixAsDataExplorer1793296971465 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // JSON_SET doesn't create the missing `presentation` object, so merge
        // into it instead.
        await queryRunner.query(
            `-- sql
            UPDATE multi_dim_data_pages
            SET config = JSON_SET(
                config,
                '$.presentation',
                JSON_MERGE_PATCH(
                    COALESCE(config -> '$.presentation', JSON_OBJECT()),
                    JSON_OBJECT(
                        'pageType', 'data-explorer',
                        'explorerSubtitle',
                        'How much of our energy comes from each source, and how this has changed over time.'
                    )
                )
            )
            WHERE slug = 'energy-mix'`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `-- sql
            UPDATE multi_dim_data_pages
            SET config = JSON_REMOVE(
                config,
                '$.presentation.pageType',
                '$.presentation.explorerSubtitle'
            )
            WHERE slug = 'energy-mix'
                AND config -> '$.presentation' IS NOT NULL`
        )
        await queryRunner.query(
            `-- sql
            UPDATE multi_dim_data_pages
            SET config = JSON_REMOVE(config, '$.presentation')
            WHERE slug = 'energy-mix'
                AND config -> '$.presentation' = JSON_OBJECT()`
        )
    }
}
