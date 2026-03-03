import { MigrationInterface, QueryRunner } from "typeorm"

export class EnableFacetingForAreaCharts1680178010470 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE charts
            SET config = JSON_REMOVE(config, "$.addCountryMode")
            WHERE
                (config ->> "$.type" = "StackedArea" OR config ->> "$.type" = "StackedBar")
                AND config ->> "$.addCountryMode" = "change-country"
                AND JSON_LENGTH(config ->> "$.data.availableEntities") > 1
                AND JSON_LENGTH(config ->> "$.dimensions") > 1 -- entities are stacked on top of each other in this case`)
    }

    public async down(): Promise<void> {} // eslint-disable-line
}
