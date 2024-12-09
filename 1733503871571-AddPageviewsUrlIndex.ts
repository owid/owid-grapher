import { MigrationInterface, QueryRunner } from "typeorm"

export class AddPageviewsUrlIndex1733503871571 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // add an index on url of the analtyics_pageviews table
        // we already have one on (day, url) but we never join that way
        await queryRunner.query(
            `CREATE INDEX analytics_pageviews_url_index ON analytics_pageviews (url)`
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX analytics_pageviews_url_index`)
    }
}
