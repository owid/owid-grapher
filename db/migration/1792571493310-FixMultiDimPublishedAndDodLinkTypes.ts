import { MigrationInterface, QueryRunner } from "typeorm"

export class FixMultiDimPublishedAndDodLinkTypes1792571493310 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // A plain TINYINT isn't converted to a boolean by our knex typeCast
        // (it only handles TINYINT(1)), so `published` came back as 0/1
        await queryRunner.query(`-- sql
            ALTER TABLE multi_dim_data_pages
            MODIFY published TINYINT(1) NOT NULL DEFAULT 0
        `)

        // Bring dod_links.linkType in line with ContentGraphLinkType, like
        // posts_gdocs_links and slideshow_links. 'chart-view' is unused.
        await queryRunner.query(`-- sql
            ALTER TABLE dod_links
            MODIFY linkType ENUM(
                'gdoc',
                'url',
                'grapher',
                'explorer',
                'narrative-chart',
                'static-viz',
                'dod',
                'guided-chart'
            ) NOT NULL
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE dod_links
            MODIFY linkType ENUM(
                'gdoc',
                'url',
                'grapher',
                'explorer',
                'chart-view',
                'dod'
            ) NOT NULL
        `)

        await queryRunner.query(`-- sql
            ALTER TABLE multi_dim_data_pages
            MODIFY published TINYINT NOT NULL DEFAULT 0
        `)
    }
}
