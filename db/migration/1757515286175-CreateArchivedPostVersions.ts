import { MigrationInterface, QueryRunner } from "typeorm"

export class CreateArchivedPostVersions1757515286175
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            CREATE TABLE archived_post_versions (
                id INT AUTO_INCREMENT PRIMARY KEY NOT NULL,
                archivalTimestamp TIMESTAMP NOT NULL,
                -- Not a FK because we want to keep posts archived
                -- even after they're deleted.
                postId VARCHAR(255) NOT NULL,
                postSlug VARCHAR(150) NOT NULL,
                hashOfInputs VARCHAR(255) NOT NULL,
                manifest JSON,

                -- Useful for querying the latest version of a post.
                UNIQUE INDEX idx_postId_archivalTimestamp (postId, archivalTimestamp),
                INDEX idx_postSlug (postSlug),
                INDEX idx_timestamp (archivalTimestamp),
                INDEX idx_hashOfInputs (hashOfInputs)
            )
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            DROP TABLE archived_post_versions
        `)
    }
}
