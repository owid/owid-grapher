import { MigrationInterface, QueryRunner } from "typeorm"

// TEMPORARY, DO NOT MERGE. Marks a single mdim as a data explorer so the
// "Data explorer" eyebrow, the /explorers listing and the homepage count can be
// checked on staging before ETL emits `presentation.pageType`.
export class TemporaryMarkEnergyMixAsDataExplorer1791986418017 implements MigrationInterface {
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
                    JSON_OBJECT('pageType', 'data-explorer')
                )
            )
            WHERE slug = 'energy-mix'`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `-- sql
            UPDATE multi_dim_data_pages
            SET config = JSON_REMOVE(config, '$.presentation.pageType')
            WHERE slug = 'energy-mix'
                AND config -> '$.presentation.pageType' IS NOT NULL`
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
