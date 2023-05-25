import { MigrationInterface, QueryRunner } from "typeorm"

export class CleanUpEntityTypes1684922736595 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
          UPDATE charts
          SET config = JSON_REMOVE(config, "$.entityType", "$.entityTypePlural")
          WHERE config->>"$.entityType" = 'country or region'
          OR config->>"$.entityType" = 'country/region'
          OR config->>"$.entityType" = 'region/country'
          OR config->>"$.entityType" = 'country / region'
      `)
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public async down(): Promise<void> {}
}
