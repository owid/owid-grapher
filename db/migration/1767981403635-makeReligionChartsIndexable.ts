import { MigrationInterface, QueryRunner } from "typeorm"

export class MakeReligionChartsIndexable1767981403635
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Set Religion tag (1862) parent to "Living Conditions, Community and Wellbeing" (1835)
        await queryRunner.query(`-- sql
            UPDATE tags
            SET parentId = 1835
            WHERE id = 1862`)

        // Make all charts tagged with Religion indexable
        await queryRunner.query(`-- sql
            UPDATE charts
            SET isIndexable = 1
            WHERE id IN (
                SELECT chartId
                FROM chart_tags
                WHERE tagId = 1862
            )`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert Religion tag parent to NULL
        await queryRunner.query(`-- sql
            UPDATE tags
            SET parentId = NULL
            WHERE id = 1862`)

        // Revert charts back to not indexable
        await queryRunner.query(`-- sql
            UPDATE charts
            SET isIndexable = 0
            WHERE id IN (
                SELECT chartId
                FROM chart_tags
                WHERE tagId = 1862
            )`)
    }
}
