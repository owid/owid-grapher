import { MigrationInterface, QueryRunner } from "typeorm"

// As of 2025-05-15, these are the last WP posts that we still publish and index to algolia
const LAST_SLUGS = [
    "glossary",
    "food-explorers",
    "history-of-poverty-data-appendix",
]

export class UnpublishWordpressPosts1747347351868
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `-- sql
            UPDATE posts
            SET status = 'draft'
            WHERE slug IN (?)
        `,
            [LAST_SLUGS]
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // No idea why we'd ever want to do this, but here it is
        await queryRunner.query(
            `-- sql
            UPDATE posts
            SET status = 'published'
            WHERE slug IN (?)
        `,
            [LAST_SLUGS]
        )
    }
}
