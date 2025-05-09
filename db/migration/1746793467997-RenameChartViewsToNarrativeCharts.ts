import { MigrationInterface, QueryRunner } from "typeorm"

export class RenameChartViewsToNarrativeCharts1746793467997
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `-- sql
            RENAME TABLE chart_views TO narrative_charts`
        )
        await queryRunner.query(
            `-- sql
            ALTER TABLE posts_gdocs_links
            MODIFY linkType ENUM ('gdoc', 'url', 'grapher', 'explorer', 'chart-view', 'narrative-chart') NULL`
        )
        await queryRunner.query(
            `-- sql
            UPDATE posts_gdocs_links
            SET linkType = 'narrative-chart'
            WHERE linkType = 'chart-view'`
        )
        await queryRunner.query(
            `-- sql
            ALTER TABLE posts_gdocs_links
            MODIFY linkType ENUM ('gdoc', 'url', 'grapher', 'explorer', 'narrative-chart') NULL`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `-- sql
            RENAME TABLE narrative_charts TO chart_views`
        )
        await queryRunner.query(
            `-- sql
            ALTER TABLE posts_gdocs_links
            MODIFY linkType ENUM ('gdoc', 'url', 'grapher', 'explorer', 'narrative-chart', 'chart-view') NULL`
        )
        await queryRunner.query(
            `-- sql
            UPDATE posts_gdocs_links
            SET linkType = 'chart-view'
            WHERE linkType = 'narrative-chart'`
        )
        await queryRunner.query(
            `-- sql
            ALTER TABLE posts_gdocs_links
            MODIFY linkType ENUM ('gdoc', 'url', 'grapher', 'explorer', 'chart-view') NULL`
        )
    }
}
