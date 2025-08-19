import { MigrationInterface, QueryRunner } from "typeorm"

export class AddPostsGdocsLinksTargetIndexes1755013960275
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add composite index for optimal performance on target + sourceId queries
        // This index can also be used for queries that only filter on target (leftmost prefix rule)
        await queryRunner.query(`
            CREATE INDEX idx_posts_gdocs_links_target_source 
            ON posts_gdocs_links(target(100), sourceId)
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop the composite index
        await queryRunner.query(`
            DROP INDEX idx_posts_gdocs_links_target_source 
            ON posts_gdocs_links
        `)
    }
}
