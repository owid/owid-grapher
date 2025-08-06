import { MigrationInterface, QueryRunner } from "typeorm"

export class GuidedChartLinkType1754483577468 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE posts_gdocs_links
            MODIFY linkType ENUM('gdoc','url','grapher','explorer','narrative-chart','dod', 'guided-chart')
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DELETE FROM posts_gdocs_links WHERE linkType = 'guided-chart';
        `)
        await queryRunner.query(`
            ALTER TABLE posts_gdocs_links
            MODIFY linkType ENUM('gdoc','url','grapher','explorer','narrative-chart','dod')
        `)
    }
}
