import { MigrationInterface, QueryRunner } from "typeorm"

const tables = [
    { table: "chart_configs", column: "patch" },
    { table: "chart_configs", column: "full" },
    { table: "chart_revisions", column: "config" },
]

export class AddDiscreteBarChartTabToAllLineCharts1748929511159
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const { table, column } of tables) {
            // Add a discrete bar chart tab to all line and slope charts
            await queryRunner.query(
                `-- sql
                    UPDATE ${table}
                    SET ${column} = JSON_SET(
                        ${column},
                        '$.chartTypes',
                        JSON_ARRAY_APPEND(${column}->'$.chartTypes', '$', 'DiscreteBar')
                    )
                    WHERE
                        (
                            JSON_SEARCH(${column}->'$.chartTypes', 'one', 'LineChart') IS NOT NULL
                            OR JSON_SEARCH(${column}->'$.chartTypes', 'one', 'SlopeChart') IS NOT NULL
                        )
                        AND JSON_SEARCH(${column}->'$.chartTypes', 'one', 'DiscreteBar') IS NULL
                `
            )
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (const { table, column } of tables) {
            // Remove the discrete bar chart tab from all line and slope charts
            await queryRunner.query(
                `-- sql
                    UPDATE ${table}
                    SET ${column} = JSON_SET(
                        ${column},
                        '$.chartTypes',
                        JSON_REMOVE(
                            ${column}->'$.chartTypes',
                            JSON_UNQUOTE(JSON_SEARCH(${column}->'$.chartTypes', 'one', 'DiscreteBar'))
                        )
                    )
                    WHERE
                        JSON_SEARCH(${column}->'$.chartTypes', 'one', 'DiscreteBar') IS NOT NULL
                        AND (
                            JSON_SEARCH(${column}->'$.chartTypes', 'one', 'LineChart') IS NOT NULL
                            OR JSON_SEARCH(${column}->'$.chartTypes', 'one', 'SlopeChart') IS NOT NULL
                        )
                `
            )
        }
    }
}
