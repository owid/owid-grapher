import { MigrationInterface, QueryRunner } from "typeorm"

const tables = [
    { table: "chart_configs", column: "patch" },
    { table: "chart_configs", column: "full" },
    { table: "chart_revisions", column: "config" },
]

export class MigrateHideLegendToHideSeriesLabels1772101247032
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const { table, column } of tables) {
            // Rename hideLegend to hideSeriesLabels for LineCharts,
            // SlopeCharts and StackedArea charts
            await queryRunner.query(
                `-- sql
                UPDATE ${table}
                SET ${column} = JSON_SET(
                    ${column},
                    '$.hideSeriesLabels',
                    TRUE
                )
                WHERE
                    COALESCE(${column} ->> '$.chartTypes[0]', 'LineChart') IN ('LineChart', 'SlopeChart', 'StackedArea')
                    AND ${column} ->> '$.hideLegend' = 'true'`
            )

            // Drop the hideLegend field for all charts
            await queryRunner.query(
                `-- sql
                UPDATE ${table}
                SET ${column} = JSON_REMOVE(${column}, '$.hideLegend')
                WHERE ${column} ->> '$.hideLegend' = 'true'`
            )

            // Update the $schema to the latest version for all charts
            await queryRunner.query(
                `-- sql
                update ${table} set ${column} = JSON_SET(${column}, "$.$schema", "https://files.ourworldindata.org/schemas/grapher-schema.010.json")`
            )
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (const { table, column } of tables) {
            // Rename hideSeriesLabels to hideLegend
            await queryRunner.query(
                `-- sql
                UPDATE ${table}
                SET ${column} = JSON_SET(
                    ${column},
                    '$.hideLegend',
                    TRUE
                )
                WHERE ${column} ->> '$.hideSeriesLabels' = 'true'`
            )

            // Revert the $schema field
            await queryRunner.query(
                `-- sql
                update ${table} set ${column} = JSON_SET(${column}, "$.$schema", "https://files.ourworldindata.org/schemas/grapher-schema.009.json")`
            )
        }
    }
}
