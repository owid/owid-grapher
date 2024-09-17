import { MigrationInterface, QueryRunner } from "typeorm"

export class MigrateOutdatedConfigsToLatestVersion1726588731621
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        // we have v3 configs in the database; turn these into v5 configs
        // by removing the `data` and `hideLinesOutsideTolerance` properties
        await queryRunner.query(
            `-- sql
              UPDATE chart_configs
              SET
                  patch = JSON_SET(
                      JSON_REMOVE(patch, '$.data', '$.hideLinesOutsideTolerance'),
                      '$.$schema',
                      'https://files.ourworldindata.org/schemas/grapher-schema.005.json'
                  ),
                  full = JSON_SET(
                      JSON_REMOVE(full, '$.data', '$.hideLinesOutsideTolerance'),
                      '$.$schema',
                      'https://files.ourworldindata.org/schemas/grapher-schema.005.json'
                  )
              WHERE patch ->> '$.$schema' = 'https://files.ourworldindata.org/schemas/grapher-schema.003.json'
            `
        )
    }

    public async down(): Promise<void> {
        throw new Error(
            "Can't revert migration MigrateOutdatedConfigsToLatestVersion1726588731621"
        )
    }
}
