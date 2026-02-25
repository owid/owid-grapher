import { MigrationInterface, QueryRunner } from "typeorm"

export class HideTimelineForDiscreteBarCharts1680614452457 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE charts
            SET config = JSON_SET(config, "$.hideTimeline", TRUE)
            WHERE config->>"$.type" = "DiscreteBar"
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE charts
            SET config = JSON_REMOVE(config, "$.hideTimeline")
            WHERE config->>"$.type" = "DiscreteBar"
        `)
    }
}
