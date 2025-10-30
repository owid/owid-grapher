import { MigrationInterface, QueryRunner } from "typeorm"

export class UniqueSlugContentTypePublished1761851637000
    implements MigrationInterface
{
    /**
     * Creates a unique index on the combination of (type, slug) for published posts only.
     * It works by indexing the concatenated string of type and slug when published is true,
     * and NULL when published is false, ensuring uniqueness only among published posts.
     */
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            CREATE UNIQUE INDEX idx_unique_published
            ON posts_gdocs(
                (
                    IF(
                        published = 1,
                        CONCAT(type, '|', slug),
                        NULL
                    )
                )
            );
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            DROP INDEX idx_unique_published ON posts_gdocs;
        `)
    }
}
