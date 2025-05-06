import { MigrationInterface, QueryRunner } from "typeorm"

const tables = [
    { table: "chart_configs", column: "patch" },
    { table: "chart_configs", column: "full" },
    { table: "chart_revisions", column: "config" },
    { table: "suggested_chart_revisions", column: "suggestedConfig" },
]

export class AddDiscreteBarChartToAllLineCharts1746539487134
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const { table, column } of tables) {
            await queryRunner.query(`-- sql
                UPDATE ${table}
                SET ${column} = JSON_SET(
                    ${column},
                    '$.chartTypes',
                    JSON_ARRAY('LineChart', 'DiscreteBar')
                )
                WHERE ${column} ->> '$.chartTypes' = '["LineChart"]'
            `)

            await queryRunner.query(`-- sql
                UPDATE ${table}
                SET ${column} = JSON_SET(
                    ${column},
                    '$.chartTypes',
                    JSON_ARRAY('LineChart', 'SlopeChart', 'DiscreteBar')
                )
                WHERE ${column} ->> '$.chartTypes' = '["LineChart", "SlopeChart"]'
            `)
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (const { table, column } of tables) {
            await queryRunner.query(`-- sql
                UPDATE ${table}
                SET ${column} = JSON_SET(
                    ${column},
                    '$.chartTypes',
                    JSON_ARRAY('LineChart')
                )
                WHERE ${column} ->> '$.chartTypes' = '["LineChart", "DiscreteBar"]'
            `)

            await queryRunner.query(`-- sql
                UPDATE ${table}
                SET ${column} = JSON_SET(
                    ${column},
                    '$.chartTypes',
                    JSON_ARRAY('LineChart', 'SlopeChart')
                )
                WHERE ${column} ->> '$.chartTypes' = '["LineChart", "SlopeChart", "DiscreteBar"]'
            `)
        }
    }
}
