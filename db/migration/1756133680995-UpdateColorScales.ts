import { MigrationInterface, QueryRunner } from "typeorm"

const tables = [
    { table: "chart_configs", column: "patch" },
    { table: "chart_configs", column: "full" },
    { table: "chart_revisions", column: "config" },
]

const fields = ["$.map.colorScale", "$.colorScale"]

export class UpdateColorScales1756133680995 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const { table, column } of tables) {
            for (const field of fields) {
                await queryRunner.query(
                    `-- sql
                    UPDATE ${table}
                    SET ${column} = JSON_REMOVE(
                        ${column},
                        '${field}.binningStrategyBinCount'
                    )
                    WHERE
                        ${column}->>'${field}.binningStrategyBinCount' IS NOT NULL
                `
                )
                await queryRunner.query(
                    `-- sql
                    UPDATE ${table}
                    SET ${column} = JSON_REMOVE(
                        ${column},
                        '${field}.binningStrategy'
                    )
                    WHERE
                        ${column}->>'${field}.binningStrategy' != 'manual'
                `
                )
            }
            await queryRunner.query(
                `-- sql
                update ${table} set ${column} = JSON_SET(${column}, "$.$schema", "https://files.ourworldindata.org/schemas/grapher-schema.009.json")`
            )
        }
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        // No down migration possible without losing information
    }
}
