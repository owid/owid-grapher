import { MigrationInterface, QueryRunner } from "typeorm"

export class AddPostsGdocsLinksTargetIndexes1755013960275
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add index on target column (with prefix length for TEXT column) for improved JOIN performance
        await queryRunner.query(`
            CREATE INDEX idx_posts_gdocs_links_target 
            ON posts_gdocs_links(target(100))
        `)

        // Add composite index for optimal performance on target + sourceId queries
        await queryRunner.query(`
            CREATE INDEX idx_posts_gdocs_links_target_source 
            ON posts_gdocs_links(target(100), sourceId)
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop the composite index first (depends on base index)
        await queryRunner.query(`
            DROP INDEX idx_posts_gdocs_links_target_source 
            ON posts_gdocs_links
        `)

        // Drop the base target index
        await queryRunner.query(`
            DROP INDEX idx_posts_gdocs_links_target 
            ON posts_gdocs_links
        `)
    }
}
