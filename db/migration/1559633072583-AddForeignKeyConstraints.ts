import { MigrationInterface, QueryRunner } from "typeorm"

export class AddForeignKeyConstraints1559633072583
    implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        // Remove all chart_slug_redirects that have had their chart deleted
        await queryRunner.query(`
            DELETE t FROM chart_slug_redirects AS t
            LEFT JOIN charts ON charts.id = t.chart_id
            WHERE charts.id IS NULL
        `)
        await queryRunner.query(
            "ALTER TABLE `chart_slug_redirects` ADD CONSTRAINT `chart_slug_redirects_chart_id` FOREIGN KEY (`chart_id`) REFERENCES `charts`(`id`)"
        )
        await queryRunner.query(
            "ALTER TABLE `chart_revisions` ADD CONSTRAINT `chart_revisions_userId` FOREIGN KEY (`userId`) REFERENCES `users`(`id`)"
        )
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(
            "ALTER TABLE `chart_slug_redirects` DROP FOREIGN KEY `chart_slug_redirects_chart_id`"
        )
        await queryRunner.query(
            "ALTER TABLE `chart_revisions` DROP FOREIGN KEY `chart_revisions_userId`"
        )
    }
}
