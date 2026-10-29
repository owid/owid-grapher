import { MigrationInterface, QueryRunner } from "typeorm"

export class RedirectFeaturedVizToTopLevelPaths1792755115971 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Delete redirects from /<slug>, which would shadow the page baked there
        await queryRunner.query(`-- sql
            DELETE r FROM redirects r
            JOIN posts_gdocs g ON r.source = CONCAT("/", g.slug)
            WHERE g.type = "featured-viz" AND g.published = 1
        `)
        // Repoint redirects that target /featured-viz/<slug> at /<slug>, collapsing chains
        await queryRunner.query(`-- sql
            UPDATE redirects r
            JOIN posts_gdocs g ON r.target = CONCAT("/featured-viz/", g.slug)
            SET r.target = CONCAT("/", g.slug)
            WHERE g.type = "featured-viz" AND g.published = 1
        `)
        // Delete self-redirects anywhere in the table, as the admin does after a path change
        await queryRunner.query(`-- sql
            DELETE FROM redirects WHERE source = target
        `)
        // Delete existing /featured-viz/<slug> sources, since redirects.source is unique
        await queryRunner.query(`-- sql
            DELETE r FROM redirects r
            JOIN posts_gdocs g ON r.source = CONCAT("/featured-viz/", g.slug)
            WHERE g.type = "featured-viz" AND g.published = 1
        `)
        // Redirect /featured-viz/<slug> to /<slug> for every published featured-viz gdoc
        await queryRunner.query(`-- sql
            INSERT INTO redirects (source, target)
            SELECT CONCAT("/featured-viz/", slug), CONCAT("/", slug)
            FROM posts_gdocs
            WHERE type = "featured-viz" AND published = 1
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Delete the /featured-viz/<slug> redirects that up() inserted
        await queryRunner.query(`-- sql
            DELETE r FROM redirects r
            JOIN posts_gdocs g ON r.source = CONCAT("/featured-viz/", g.slug)
            WHERE g.type = "featured-viz" AND g.published = 1
        `)
        // Delete existing /<slug> sources, since redirects.source is unique
        await queryRunner.query(`-- sql
            DELETE r FROM redirects r
            JOIN posts_gdocs g ON r.source = CONCAT("/", g.slug)
            WHERE g.type = "featured-viz" AND g.published = 1
        `)
        // Restore /<slug> -> /featured-viz/<slug> for every published featured-viz gdoc
        await queryRunner.query(`-- sql
            INSERT INTO redirects (source, target)
            SELECT CONCAT("/", slug), CONCAT("/featured-viz/", slug)
            FROM posts_gdocs
            WHERE type = "featured-viz" AND published = 1
        `)
    }
}
