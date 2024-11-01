import { defaultGrapherConfig } from "@ourworldindata/grapher"
import { mergeGrapherConfigs } from "@ourworldindata/utils"
import { MigrationInterface, QueryRunner } from "typeorm"

export class RemoveDefaultConfigLayer1730455806132
    implements MigrationInterface
{
    private async recomputeFullChartConfigs(
        queryRunner: QueryRunner,
        { useDefaultLayer }: { useDefaultLayer: boolean }
    ): Promise<void> {
        const charts = await queryRunner.query(`
             -- sql
             SELECT
                 cc.id AS configId,
                 cc.patch AS patchConfig,
                 cc_etl.patch AS etlConfig,
                 cc_admin.patch AS adminConfig,
                 c.isInheritanceEnabled
             FROM charts c
             JOIN chart_configs cc ON cc.id = c.configId
             LEFT JOIN charts_x_parents cxp ON cxp.chartId = c.id
             LEFT JOIN variables v ON v.id = cxp.variableId
             LEFT JOIN chart_configs cc_etl ON cc_etl.id = v.grapherConfigIdETL
             LEFT JOIN chart_configs cc_admin ON cc_admin.id = v.grapherConfigIdAdmin
         `)
        for (const chart of charts) {
            const patchConfig = JSON.parse(chart.patchConfig)

            const etlConfig = chart.etlConfig ? JSON.parse(chart.etlConfig) : {}
            const adminConfig = chart.adminConfig
                ? JSON.parse(chart.adminConfig)
                : {}

            const fullConfig = mergeGrapherConfigs(
                useDefaultLayer ? defaultGrapherConfig : {},
                chart.isInheritanceEnabled ? etlConfig : {},
                chart.isInheritanceEnabled ? adminConfig : {},
                patchConfig
            )

            await queryRunner.query(
                `
                    -- sql
                    UPDATE chart_configs cc
                    SET cc.full = ?
                    WHERE cc.id = ?
                `,
                [JSON.stringify(fullConfig), chart.configId]
            )
        }
    }

    private async updateChartsXParentsView(
        queryRunner: QueryRunner
    ): Promise<void> {
        // identical to the current view definition,
        // but uses `COALESCE(cc.full ->> '$.type', 'LineChart')`
        // instead of `cc.full ->> '$.type'` since the full config
        // might not have a type
        await queryRunner.query(`-- sql
          ALTER VIEW charts_x_parents AS (
            WITH y_dimensions AS (
              SELECT
                *
              FROM
                chart_dimensions
              WHERE
                property = 'y'
            ),
            single_y_indicator_charts AS (
              SELECT
                c.id as chartId,
                cc.patch as patchConfig,
                -- should only be one
                max(yd.variableId) as variableId
              FROM
                charts c
                JOIN chart_configs cc ON cc.id = c.configId
                JOIN y_dimensions yd ON c.id = yd.chartId
              WHERE
                -- scatter plots can't inherit settings
                COALESCE(cc.full ->> '$.type', 'LineChart') != 'ScatterPlot'
              GROUP BY
                c.id
              HAVING
                -- restrict to single y-variable charts
                COUNT(distinct yd.variableId) = 1
            )
            SELECT
              variableId,
              chartId
            FROM
              single_y_indicator_charts
            ORDER BY
              variableId
          )
        `)
    }

    public async up(queryRunner: QueryRunner): Promise<void> {
        await this.recomputeFullChartConfigs(queryRunner, {
            useDefaultLayer: false,
        })
        await this.updateChartsXParentsView(queryRunner)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await this.recomputeFullChartConfigs(queryRunner, {
            useDefaultLayer: true,
        })
    }
}
