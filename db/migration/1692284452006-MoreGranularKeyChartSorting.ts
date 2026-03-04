import { MigrationInterface, QueryRunner } from "typeorm"

export class MoreGranularKeyChartSorting1692284452006 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Update chart_tags table to rename isKeyChart to keyChartLevel
        await queryRunner.query(`
            ALTER TABLE chart_tags
            RENAME COLUMN isKeyChart TO keyChartLevel
        `)

        // Update chart_tags table so that:
        // - the legacy isKeyChart === 0 (false) becomes 2 (middle). In the
        //   legacy system, non-key charts (0) were shown in the all charts
        //   block. Some curation has been done already with this assumption in
        //   mind, so we preserve the old behaviour through the migration, while
        //   giving the tools to demote those charts if necessary.
        // - and isKeyChart === 1 (true) becomes 3 (top)
        await queryRunner.query(`
            UPDATE chart_tags
            SET keyChartLevel = keyChartLevel + 2
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE chart_tags
            SET keyChartLevel = keyChartLevel - 2
        `)

        await queryRunner.query(`
            ALTER TABLE chart_tags
            RENAME COLUMN keyChartLevel TO isKeyChart
        `)
    }
}
