import { MigrationInterface, QueryRunner } from "typeorm"

export class RealignPostsGdocsLinksLinkType1792576722630 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // StaticVizLinkType1751646349658 has an older timestamp than
        // GuidedChartLinkType1754483577468 but was merged after it, so the two
        // ran in different orders on existing and fresh databases. Existing
        // ones (like prod) ended up with the definition below; fresh ones
        // (like the db test database) without 'static-viz' and nullable. This
        // is a no-op on the former and fixes the latter.
        await queryRunner.query(`-- sql
            ALTER TABLE posts_gdocs_links
            MODIFY linkType ENUM(
                'gdoc',
                'url',
                'grapher',
                'explorer',
                'narrative-chart',
                'dod',
                'guided-chart',
                'static-viz'
            ) NOT NULL
        `)
    }

    public async down(): Promise<void> {
        // Nothing to undo: up() only restores the definition prod already has
    }
}
