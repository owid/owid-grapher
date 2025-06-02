import { MigrationInterface, QueryRunner } from "typeorm"

const tables = [
    { table: "chart_configs", column: "patch" },
    { table: "chart_configs", column: "full" },
    { table: "chart_revisions", column: "config" },
]

export class AddStartTimeToMapConfig1760952848159
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const { table, column } of tables) {
            // Replace map.time with map.endTime
            await queryRunner.query(
                `-- sql
                    UPDATE chart_configs
                    SET full = JSON_SET(
                        JSON_REMOVE(full, '$.map.time'),
                        '$.map.endTime',
                        full -> '$.map.time'
                    )
                    WHERE full -> '$.map.time' IS NOT NULL;
                `
            )

            // Update schema version
            await queryRunner.query(
                `-- sql
                    UPDATE ${table}
                    SET ${column} = JSON_SET(${column}, "$.$schema", "https://files.ourworldindata.org/schemas/grapher-schema.010.json")
                `
            )
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (const { table, column } of tables) {
            // Replace map.endTime with map.time
            await queryRunner.query(
                `-- sql
                    UPDATE chart_configs
                    SET full = JSON_SET(
                        JSON_REMOVE(full, '$.map.endTime'),
                        '$.map.time',
                        full -> '$.map.endTime'
                    )
                    WHERE full -> '$.map.endTime' IS NOT NULL;
                `
            )

            // Update schema version
            await queryRunner.query(
                `-- sql
                    UPDATE ${table}
                    SET ${column} = JSON_SET(${column}, "$.$schema", "https://files.ourworldindata.org/schemas/grapher-schema.009.json")
                `
            )
        }
    }
}
