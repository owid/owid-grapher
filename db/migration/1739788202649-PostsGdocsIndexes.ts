import { MigrationInterface, QueryRunner } from "typeorm"

export class PostsGdocsIndexes1739788202649 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Change `type` col def from `VIRTUAL` to `STORED`
        await queryRunner.query(`-- sql
            ALTER TABLE posts_gdocs
            DROP INDEX idx_posts_gdocs_type,
            DROP COLUMN type,
            ADD COLUMN type VARCHAR(255) GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(content, '$.type'))) STORED AFTER slug
        `)

        // Add a combined index on `type`, `published` and `publishedAt`
        // It can get used for just `type` queries, and often times we also filter by `published` in the same query
        // and potentially by `publishedAt` as well
        await queryRunner.query(`-- sql
            ALTER TABLE posts_gdocs
            ADD INDEX idx_posts_gdocs_type_published_publishedAt (type, published, publishedAt)
        `)

        // Another common type of query is to filter/sort by `published` and `publishedAt`
        await queryRunner.query(`-- sql
            ALTER TABLE posts_gdocs
            ADD INDEX idx_posts_gdocs_published_publishedAt (published, publishedAt)
        `)

        // Add a computed stored column for `authors`
        await queryRunner.query(`-- sql
            ALTER TABLE posts_gdocs
            ADD COLUMN authors JSON GENERATED ALWAYS AS (JSON_EXTRACT(content, '$.authors')) STORED AFTER content
        `)

        // Add a composite index on `posts_gdocs_links` for `linkType` and `componentType` - we especially use queries for `linkType = 'grapher'`
        await queryRunner.query(`-- sql
            CREATE INDEX idx_linkType_componentType ON posts_gdocs_links (linkType, componentType)
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            DROP INDEX idx_linkType_componentType ON posts_gdocs_links
        `)

        await queryRunner.query(`-- sql
            ALTER TABLE posts_gdocs
            DROP COLUMN authors
        `)

        await queryRunner.query(`-- sql
            DROP INDEX idx_posts_gdocs_published_publishedAt ON posts_gdocs
        `)

        await queryRunner.query(`-- sql
            DROP INDEX idx_posts_gdocs_type_published_publishedAt ON posts_gdocs
        `)

        await queryRunner.query(`-- sql
            ALTER TABLE posts_gdocs
            DROP COLUMN type,
            ADD COLUMN type VARCHAR(255) GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(content, '$.type'))) VIRTUAL AFTER slug,
            ADD INDEX idx_posts_gdocs_type (type)
        `)
    }
}
