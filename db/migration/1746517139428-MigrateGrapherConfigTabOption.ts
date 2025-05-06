import { MigrationInterface, QueryRunner } from "typeorm"

const tables = [
    { table: "chart_configs", column: "patch" },
    { table: "chart_configs", column: "full" },
    { table: "chart_revisions", column: "config" },
    { table: "suggested_chart_revisions", column: "suggestedConfig" },
]

export class MigrateGrapherConfigTabOption1746517139428
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const { table, column } of tables) {
            await queryRunner.query(`-- sql
                UPDATE ${table}
                SET ${column} = JSON_SET(
                    ${column},
                    '$.tab',
                    CASE ${column} ->> '$.tab'
                        WHEN 'chart' THEN 'Chart'
                        WHEN 'map' THEN 'WorldMap'
                        WHEN 'table' THEN 'Table'
                        WHEN 'line' THEN 'LineChart'
                        WHEN 'slope' THEN 'SlopeChart'
                        ELSE ${column} ->> '$.tab'
                    END
                )
                WHERE ${column} ->> '$.tab' IS NOT NULL
            `)
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (const { table, column } of tables) {
            await queryRunner.query(`-- sql
                UPDATE ${table}
                SET ${column} = JSON_SET(
                    ${column},
                    '$.tab',
                    CASE ${column} ->> '$.tab'
                        WHEN 'Chart' THEN 'chart'
                        WHEN 'WorldMap' THEN 'map'
                        WHEN 'Table' THEN 'table'
                        WHEN 'LineChart' THEN 'line'
                        WHEN 'SlopeChart' THEN 'slope'
                        ELSE ${column} ->> '$.tab'
                    END
                )
                WHERE ${column} ->> '$.tab' IS NOT NULL
            `)
        }
    }
}
