import { MigrationInterface, QueryRunner } from "typeorm"

export class RemoveSizeDimensionFromSlopeCharts1709735276047
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        const configColumns = [
            { table: "charts", column: "config" },
            { table: "chart_revisions", column: "config" },
            { table: "suggested_chart_revisions", column: "suggestedConfig" },
            { table: "variables", column: "grapherConfigAdmin" },
            { table: "variables", column: "grapherConfigETL" },
        ]

        // remove the size dimension from all configs in the database
        for (const { table, column } of configColumns) {
            const slopeCharts = await queryRunner.query(
                `SELECT id, ?? FROM ?? WHERE ?? ->> "$.type" = 'SlopeChart'`,
                [column, table, column]
            )

            // update all slope charts that currently have a size dimension
            for (const chart of slopeCharts) {
                const config = JSON.parse(chart[column])
                if (!config.dimensions) continue

                const index = config.dimensions.findIndex(
                    (dimension: any) => dimension.property === "size"
                )
                if (index >= 0) {
                    config.dimensions.splice(index, 1)
                    await queryRunner.query(
                        `UPDATE ?? SET ?? = ? WHERE id = ?`,
                        [table, column, JSON.stringify(config), chart.id]
                    )
                }
            }
        }

        // drop rows from the chart dimensions table
        await queryRunner.query(
            `-- sql
            DELETE cd
            FROM chart_dimensions cd
            JOIN charts c ON c.id = cd.chartId
            WHERE
                c.type = "SlopeChart"
                AND property = "size"`
        )
    }

    // eslint-disable-next-line
    public async down(queryRunner: QueryRunner): Promise<void> {}
}
