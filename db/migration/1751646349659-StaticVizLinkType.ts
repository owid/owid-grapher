import { MigrationInterface, QueryRunner } from "typeorm"

export class StaticVizLinkType1751646349658 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE posts_gdocs_links
            MODIFY linkType enum('gdoc','url','grapher','explorer','narrative-chart','dod','guided-chart','static-viz') NOT NULL
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            DELETE FROM posts_gdocs_links WHERE linkType = 'static-viz';
        `)

        await queryRunner.query(`-- sql
            ALTER TABLE posts_gdocs_links
            MODIFY linkType ENUM('gdoc','url','grapher','explorer','narrative-chart','dod','guided-chart') NOT NULL
        `)
    }
}
