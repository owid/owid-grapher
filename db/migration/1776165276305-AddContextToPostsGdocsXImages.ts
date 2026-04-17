import { MigrationInterface, QueryRunner } from "typeorm"

export class AddContextToPostsGdocsXImages1776165276305 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE posts_gdocs_x_images
            ADD COLUMN context ENUM('content', 'article-thumbnail') NOT NULL DEFAULT 'content'
        `)

        // Backfill: mark existing rows as 'article-thumbnail' where the image
        // appears only in article-reference slots (R&W blocks, prominent-link
        // thumbnails) and not as genuine inline body content.
        await queryRunner.query(`-- sql
            UPDATE posts_gdocs_x_images pxi
            JOIN posts_gdocs pg ON pxi.gdocId = pg.id
            JOIN images i ON pxi.imageId = i.id
            SET pxi.context = 'article-thumbnail'
            WHERE
                -- Appears in at least one article-reference slot
                -- (R&W links or prominent-link thumbnails)
                (
                    JSON_SEARCH(pg.content, 'one', i.filename, NULL, '$.body[*].primary[*].value.filename') IS NOT NULL
                    OR JSON_SEARCH(pg.content, 'one', i.filename, NULL, '$.body[*].secondary[*].value.filename') IS NOT NULL
                    OR JSON_SEARCH(pg.content, 'one', i.filename, NULL, '$.body[*].rows[*].articles[*].value.filename') IS NOT NULL
                    OR JSON_SEARCH(pg.content, 'one', i.filename, NULL, '$.body[*].more.articles[*].value.filename') IS NOT NULL
                    OR JSON_SEARCH(pg.content, 'one', i.filename, NULL, '$.body[*].latest.articles[*].value.filename') IS NOT NULL
                    OR JSON_SEARCH(pg.content, 'one', i.filename, NULL, '$.body[*].thumbnail') IS NOT NULL
                    OR JSON_SEARCH(pg.content, 'one', i.filename, NULL, '$.body[*].left[*].thumbnail') IS NOT NULL
                    OR JSON_SEARCH(pg.content, 'one', i.filename, NULL, '$.body[*].right[*].thumbnail') IS NOT NULL
                    OR JSON_SEARCH(pg.content, 'one', i.filename, NULL, '$.body[*].insights[*].content[*].thumbnail') IS NOT NULL
                )
                -- But is NOT the article's own featured image
                AND i.filename != COALESCE(pg.content->>'$."featured-image"', '')
                AND i.filename != COALESCE(pg.content->>'$."cover-image"', '')
                -- And does NOT appear as genuine inline body content
                -- (image/video block, key-insights insight image, chart-rows image,
                --  pull-chart image, person image, homepage-intro featured work)
                AND NOT (
                    JSON_SEARCH(pg.content, 'one', i.filename, NULL, '$.body[*].filename') IS NOT NULL
                    OR JSON_SEARCH(pg.content, 'one', i.filename, NULL, '$.body[*].smallFilename') IS NOT NULL
                    OR JSON_SEARCH(pg.content, 'one', i.filename, NULL, '$.body[*].insights[*].filename') IS NOT NULL
                    OR JSON_SEARCH(pg.content, 'one', i.filename, NULL, '$.body[*].featuredWork[*].filename') IS NOT NULL
                    OR JSON_SEARCH(pg.content, 'one', i.filename, NULL, '$.body[*].rows[*].image') IS NOT NULL
                    OR JSON_SEARCH(pg.content, 'one', i.filename, NULL, '$.body[*].image') IS NOT NULL
                )
        `)

        // Backfill: mark featured-image and cover-image rows as 'article-thumbnail'
        // unless the same image also appears as genuine inline body content.
        await queryRunner.query(`-- sql
            UPDATE posts_gdocs_x_images pxi
            JOIN posts_gdocs pg ON pxi.gdocId = pg.id
            JOIN images i ON pxi.imageId = i.id
            SET pxi.context = 'article-thumbnail'
            WHERE
                (
                    i.filename = pg.content->>'$."featured-image"'
                    OR i.filename = pg.content->>'$."cover-image"'
                )
                AND NOT (
                    JSON_SEARCH(pg.content, 'one', i.filename, NULL, '$.body[*].filename') IS NOT NULL
                    OR JSON_SEARCH(pg.content, 'one', i.filename, NULL, '$.body[*].smallFilename') IS NOT NULL
                    OR JSON_SEARCH(pg.content, 'one', i.filename, NULL, '$.body[*].insights[*].filename') IS NOT NULL
                    OR JSON_SEARCH(pg.content, 'one', i.filename, NULL, '$.body[*].featuredWork[*].filename') IS NOT NULL
                    OR JSON_SEARCH(pg.content, 'one', i.filename, NULL, '$.body[*].rows[*].image') IS NOT NULL
                    OR JSON_SEARCH(pg.content, 'one', i.filename, NULL, '$.body[*].image') IS NOT NULL
                )
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE posts_gdocs_x_images
            DROP COLUMN context
        `)
    }
}
