import { MigrationInterface, QueryRunner } from "typeorm"

export class RedirectFeaturedVizToTopLevelPaths1792755115971 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            DELETE r FROM redirects r
            JOIN posts_gdocs g ON r.source = CONCAT("/", g.slug)
            WHERE g.type = "featured-viz" AND g.published = 1
        `)
        await queryRunner.query(`-- sql
            UPDATE redirects r
            JOIN posts_gdocs g ON r.target = CONCAT("/featured-viz/", g.slug)
            SET r.target = CONCAT("/", g.slug)
            WHERE g.type = "featured-viz" AND g.published = 1
        `)
        await queryRunner.query(`-- sql
            DELETE FROM redirects WHERE source = target
        `)
        await queryRunner.query(`-- sql
            DELETE r FROM redirects r
            JOIN posts_gdocs g ON r.source = CONCAT("/featured-viz/", g.slug)
            WHERE g.type = "featured-viz" AND g.published = 1
        `)
        await queryRunner.query(`-- sql
            INSERT INTO redirects (source, target)
            SELECT CONCAT("/featured-viz/", slug), CONCAT("/", slug)
            FROM posts_gdocs
            WHERE type = "featured-viz" AND published = 1
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            DELETE r FROM redirects r
            JOIN posts_gdocs g ON r.source = CONCAT("/featured-viz/", g.slug)
            WHERE g.type = "featured-viz" AND g.published = 1
        `)
        await queryRunner.query(`-- sql
            DELETE r FROM redirects r
            JOIN posts_gdocs g ON r.source = CONCAT("/", g.slug)
            WHERE g.type = "featured-viz" AND g.published = 1
        `)
        await queryRunner.query(`-- sql
            INSERT INTO redirects (source, target)
            SELECT CONCAT("/", slug), CONCAT("/featured-viz/", slug)
            FROM posts_gdocs
            WHERE type = "featured-viz" AND published = 1
        `)
    }
}
