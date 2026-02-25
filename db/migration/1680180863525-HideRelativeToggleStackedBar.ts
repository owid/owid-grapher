import { MigrationInterface, QueryRunner } from "typeorm"

export class HideRelativeToggleStackedBar1680180863525 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
        UPDATE charts
        SET config = JSON_SET(config, "$.hideRelativeToggle", TRUE)
        WHERE config->>"$.type" = "StackedBar"
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
        UPDATE charts
        SET config = JSON_REMOVE(config, "$.hideRelativeToggle")
        WHERE config->>"$.type" = "StackedBar"
        `)
    }
}
