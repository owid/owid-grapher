import { MigrationInterface, QueryRunner } from "typeorm"

export class FixChartsXParentsViewNullChartType1768494494681 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Fix the charts_x_parents view to include charts with NULL chartType
        // These are charts with chartTypes=[] (no chart tab, only map),
        // which were being incorrectly excluded because NULL != 'ScatterPlot'
        // evaluates to NULL
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
                  -- NULL chartType means no chart tab (chartTypes=[]), which should be included
                  (cc.chartType != 'ScatterPlot' OR cc.chartType IS NULL)
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

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert to the old (buggy) version of the charts_x_parents view
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
                  cc.chartType != 'ScatterPlot'
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
}
