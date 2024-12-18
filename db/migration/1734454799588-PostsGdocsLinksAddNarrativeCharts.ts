import { MigrationInterface, QueryRunner } from "typeorm"

export class PostsGdocsLinksAddNarrativeCharts1734454799588
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE posts_gdocs_links
            MODIFY linkType ENUM ('gdoc', 'url', 'grapher', 'explorer', 'narrative-chart') NULL`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE posts_gdocs_links
            MODIFY linkType ENUM ('gdoc', 'url', 'grapher', 'explorer') NULL`)
    }
}
