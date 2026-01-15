import { MigrationInterface, QueryRunner } from "typeorm"

export class DropIsIndexableColumn1768502507034 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE charts
            DROP COLUMN isIndexable
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE charts
            ADD COLUMN isIndexable TINYINT(1) NOT NULL DEFAULT 0
        `)
        await queryRunner.query(`-- sql
            UPDATE charts c
            SET isIndexable = CASE
            -- NOT tagged "Unlisted"
            WHEN EXISTS (
                SELECT 1 FROM chart_tags ct_unlisted
                JOIN tags t_unlisted ON ct_unlisted.tagId = t_unlisted.id
                WHERE ct_unlisted.chartId = c.id AND t_unlisted.name = 'Unlisted'
            ) THEN 0
            -- tagged with at least one indexable tag (topic page OR searchableInAlgolia)
            WHEN EXISTS (
                SELECT 1 FROM chart_tags ct_topic
                JOIN tags t_topic ON ct_topic.tagId = t_topic.id
                LEFT JOIN posts_gdocs pg ON pg.slug = t_topic.slug
                WHERE ct_topic.chartId = c.id
                AND (
                    t_topic.searchableInAlgolia = TRUE
                    OR (
                        pg.published = TRUE
                        AND pg.type IN ('topic-page', 'linear-topic-page', 'article')
                    )
                )
            ) THEN 1
            ELSE 0
            END
            WHERE publishedAt IS NOT NULL
        `)
    }
}
