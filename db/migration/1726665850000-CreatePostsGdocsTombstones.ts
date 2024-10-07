import { MigrationInterface, QueryRunner } from "typeorm"

export class CreatePostsGdocsTombstones1726665850000
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            CREATE TABLE posts_gdocs_tombstones (
                id SERIAL PRIMARY KEY,
                gdocId VARCHAR(255) UNIQUE,
                slug VARCHAR(255) NOT NULL UNIQUE,
                reason TEXT NOT NULL DEFAULT (''),
                includeArchiveLink BOOLEAN NOT NULL DEFAULT (false),
                relatedLinkUrl TEXT NOT NULL DEFAULT (''),
                relatedLinkTitle VARCHAR(255) NOT NULL DEFAULT (''),
                relatedLinkDescription TEXT NOT NULL DEFAULT (''),
                relatedLinkThumbnail VARCHAR(255) NOT NULL DEFAULT (''),
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `)
        // For baking images.
        await queryRunner.query(`-- sql
            CREATE INDEX idx_related_link_thumbnail
            ON posts_gdocs_tombstones (relatedLinkThumbnail)
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            DROP INDEX idx_related_link_thumbnail ON posts_gdocs_tombstones
        `)
        await queryRunner.query(`-- sql
            DROP TABLE posts_gdocs_tombstones
        `)
    }
}
