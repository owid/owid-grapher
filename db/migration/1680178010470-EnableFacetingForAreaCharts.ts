import { MigrationInterface, QueryRunner } from "typeorm"

export class EnableFacetingForAreaCharts1680178010470
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE charts
            SET config = JSON_REMOVE(config, "$.addCountryMode")
            WHERE
                config ->> "$.type" = "StackedArea"
                AND JSON_LENGTH(config ->> "$.data.availableEntities") > 1
                AND config ->> "$.addCountryMode" = "change-country"
                AND (
                    config ->> "$.selectedEntityIds" IS NULL
                    OR config ->> "$.selectedEntityIds[0]" = 355 -- 355=World
                )`)
    }

    public async down(): Promise<void> {} // eslint-disable-line
}
