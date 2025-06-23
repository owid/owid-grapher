import * as _ from "lodash-es"
import { MigrationInterface, QueryRunner } from "typeorm"

export class FixChartConfigDisplayShortUnitNull1690795517408
    implements MigrationInterface
{
    private fixConfigs(
        charts: { id: number; config: Record<string, any> }[]
    ): { id: number; config: string }[] {
        const fixedCharts: { id: number; config: string }[] = []
        for (const oldChart of charts) {
            const chart = _.cloneDeep(oldChart)
            let chartModified = false
            // if any of the dimensions has a shortUnit field that is null, remove it
            if (chart.config.dimensions) {
                for (const dimension of chart.config.dimensions) {
                    if (
                        dimension.display &&
                        "shortUnit" in dimension.display &&
                        dimension.display.shortUnit === null
                    ) {
                        delete dimension.display.shortUnit
                        chartModified = true
                    }
                }
            }
            if (chartModified) {
                fixedCharts.push({
                    id: chart.id,
                    config: JSON.stringify(chart.config),
                })
            }
        }
        return fixedCharts
    }
    public async up(queryRunner: QueryRunner): Promise<void> {
        const tables = {
            suggested_chart_revisions: "suggestedConfig",
            chart_revisions: "config",
            charts: "config",
        }

        for (const [tableName, columnName] of Object.entries(tables)) {
            // where the .display.shortUnit field contains null, remove the field
            const chartsPrimitive: { id: number; config: string }[] =
                await queryRunner.query(
                    `select id, ${columnName} as config from ${tableName}`
                )
            const charts: { id: number; config: Record<string, any> }[] =
                chartsPrimitive.map((chart) => ({
                    id: chart.id,
                    config: JSON.parse(chart.config),
                }))

            const fixedCharts = this.fixConfigs(charts)
            // update the charts
            for (const chart of fixedCharts) {
                await queryRunner.query(
                    `update ${tableName} set ${columnName} = ? where id = ?`,
                    [chart.config, chart.id]
                )
            }
        }
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        return
    }
}
