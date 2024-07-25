import { cloneDeep } from "lodash"
import { MigrationInterface, QueryRunner } from "typeorm"

export class ChartsFixSchemaViolations1686644029475
    implements MigrationInterface
{
    private fixConfigs(
        charts: { id: number; config: Record<string, any> }[]
    ): { id: number; config: string }[] {
        const fixedCharts: { id: number; config: string }[] = []
        for (const oldChart of charts) {
            const chart = cloneDeep(oldChart)
            // Make sure that every chart in the db has an id field in the config
            if (!chart.config.id) {
                chart.config.id = chart.id
            }

            // In the dimensions array, remove all fields "id", "chartId", "order")
            // and drop display->shortUnit if it is null and targetYear if it is null
            if (chart.config.dimensions) {
                for (const dimension of chart.config.dimensions) {
                    delete dimension.id
                    delete dimension.chartId
                    delete dimension.order

                    if (dimension.display) {
                        if (dimension.display.shortUnit === null) {
                            delete dimension.display.shortUnit
                        }
                    }
                    if (dimension.targetYear === null) {
                        delete dimension.targetYear
                    }
                }
            }
            // In map, remove "columnSlug"
            if (chart.config.map) {
                delete chart.config.map.columnSlug
                // Drop field if map.time is null
                if (chart.config.map.time === null) {
                    delete chart.config.map.time
                }
            }

            // Drop null values in these fields: maxTime, timelineMaxTime
            if (chart.config.maxTime === null) {
                delete chart.config.maxTime
            }
            if (chart.config.timelineMaxTime === null) {
                delete chart.config.timelineMaxTime
            }

            // at the top level drop bakedGrapherURL, adminBaseUrl
            delete chart.config.bakedGrapherURL
            delete chart.config.adminBaseUrl

            // drop null values in selectedEntityNames array
            if (chart.config.selectedEntityNames) {
                chart.config.selectedEntityNames =
                    chart.config.selectedEntityNames.filter(
                        (name: string) => name !== null
                    )
            }

            // at the top level, drop details if it exists (legacy Details on Demand before we had global ones)
            delete chart.config.details

            // If the chart has changed then add it to the list of charts to return
            const serializedChart = {
                id: chart.id,
                config: JSON.stringify(chart.config),
            }
            if (serializedChart.config !== JSON.stringify(oldChart.config)) {
                fixedCharts.push(serializedChart)
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
            console.log(`Updated ${fixedCharts.length} charts in ${tableName}`)

            // now update all json configs to include a new field $schema with the current schema url https://files.ourworldindata.org/schemas/grapher-schema.003.json
            await queryRunner.query(
                `update ${tableName} set ${columnName} = JSON_SET(${columnName}, "$.$schema", "https://files.ourworldindata.org/schemas/grapher-schema.003.json")`
            )
        }
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        return // es-lint complains on empty async functions
    }
}
