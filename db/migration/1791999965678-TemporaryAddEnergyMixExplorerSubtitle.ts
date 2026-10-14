import { MigrationInterface, QueryRunner } from "typeorm"

// TEMPORARY, DO NOT MERGE. Gives the energy-mix data explorer an
// `explorerSubtitle`, so its /explorers card can be checked on staging.
export class TemporaryAddEnergyMixExplorerSubtitle1791999965678 implements MigrationInterface {
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
            SET config = JSON_REMOVE(config, '$.presentation.explorerSubtitle')
            WHERE slug = 'energy-mix'
                AND config -> '$.presentation.explorerSubtitle' IS NOT NULL`
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
