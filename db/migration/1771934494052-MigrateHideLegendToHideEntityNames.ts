import { MigrationInterface, QueryRunner } from "typeorm"

const tables = [
    { table: "chart_configs", column: "patch" },
    { table: "chart_configs", column: "full" },
    { table: "chart_revisions", column: "config" },
]

export class MigrateHideLegendToHideSeriesLabels1771934494052
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const { table, column } of tables) {
            // For LineCharts, SlopeCharts and StackedArea charts with hideLegend: true,
            // migrate to hideSeriesLabels: true and remove hideLegend
            await queryRunner.query(
                `-- sql
                UPDATE ${table}
                SET ${column} = JSON_SET(
                    JSON_REMOVE(${column}, '$.hideLegend'),
                    '$.hideSeriesLabels',
                    TRUE
                )
                WHERE
                    COALESCE(${column} ->> '$.chartTypes[0]', 'LineChart') IN ('LineChart', 'SlopeChart', 'StackedArea')
                    AND ${column} ->> '$.hideLegend' = 'true'`
            )

            // For DiscreteBar charts, Scatter plots and Marimekko charts,
            // drop the hideLegend setting since it currently has no effect
            await queryRunner.query(
                `-- sql
                UPDATE ${table}
                SET ${column} = JSON_REMOVE(${column}, '$.hideLegend')
                WHERE
                    COALESCE(${column} ->> '$.chartTypes[0]', 'LineChart') IN ('DiscreteBar', 'ScatterPlot', 'Marimekko')
                    AND ${column} ->> '$.hideLegend' = 'true'`
            )

            // Other chart types remain unchanged: StackedDiscreteBar, StackedBar
        }
    }

    public async down(): Promise<void> {
        // Not reversible
    }
}
