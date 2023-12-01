import { MigrationInterface, QueryRunner } from "typeorm"

export class RenameAnalyticsPageviews1701443655214
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            "ALTER TABLE `pageviews` RENAME TO `analytics_pageviews`"
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            "ALTER TABLE `analytics_pageviews` RENAME TO `pageviews`"
        )
    }
}
