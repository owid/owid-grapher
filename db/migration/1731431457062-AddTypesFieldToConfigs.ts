import { MigrationInterface, QueryRunner } from "typeorm"

export class AddTypesFieldToConfigs1731431457062 implements MigrationInterface {
    private async updateSchema(
        queryRunner: QueryRunner,
        newVersion: `${number}${number}${number}`
    ): Promise<void> {
        const schema = `https://files.ourworldindata.org/schemas/grapher-schema.${newVersion}.json`
        await queryRunner.query(
            `
             -- sql
                 UPDATE chart_configs
                 SET
                     patch = JSON_SET(patch, '$.$schema', ?),
                     full = JSON_SET(full, '$.$schema', ?)
             `,
            [schema, schema]
        )
    }

    private async addChartTypesFieldToConfigs(
        queryRunner: QueryRunner
    ): Promise<void> {
        for (const configType of ["patch", "full"]) {
            // if hasChartTab is true, set the types field to the current type
            await queryRunner.query(
                `
                -- sql
                    UPDATE chart_configs
                    SET ?? = JSON_SET(
                        ??,
                        '$.chartTypes',
                        JSON_ARRAY(?? ->> '$.type')
                    )
                    WHERE
                        COALESCE(?? ->> '$.hasChartTab', 'true') = 'true'
                        AND ?? ->> '$.type' IS NOT NULL
                `,
                [configType, configType, configType, configType, configType]
            )

            // if hasChartTab is false, set the types field to an empty array
            await queryRunner.query(
                `
                -- sql
                    UPDATE chart_configs
                    SET ?? = JSON_SET(
                        ??,
                        '$.chartTypes',
                        JSON_ARRAY()
                    )
                    WHERE ?? ->> '$.hasChartTab' = 'false'
                `,
                [configType, configType, configType]
            )
        }
    }

    private async addDerivedChartTypeColumn(
        queryRunner: QueryRunner
    ): Promise<void> {
        await queryRunner.query(
            `-- sql
                ALTER TABLE chart_configs
                    ADD COLUMN chartType VARCHAR(255) GENERATED ALWAYS AS
                        (
                            CASE
                                -- if types is unset, the type defaults to line chart
                                WHEN full ->> '$.chartTypes' IS NULL THEN 'LineChart'
                                -- else, the chart type listed first is considered the "main" type
                                -- (might be null for Graphers without a chart tab)
                                ELSE full ->> '$.chartTypes[0]'
                            END
                        )
                        STORED AFTER slug;
            `
        )
    }

    private async removeTypeAndHasChartTabFields(
        queryRunner: QueryRunner
    ): Promise<void> {
        await queryRunner.query(`
            -- sql
            UPDATE chart_configs
            SET patch = JSON_REMOVE(patch, '$.type', '$.hasChartTab')
        `)
    }

    private async removeDerivedTypeColumn(
        queryRunner: QueryRunner
    ): Promise<void> {
        await queryRunner.query(
            `-- sql
                 ALTER TABLE chart_configs
                 DROP COLUMN chartType;
             `
        )
    }

    private async addTypeAndHasChartTabFields(
        queryRunner: QueryRunner
    ): Promise<void> {
        for (const configType of ["patch", "full"]) {
            await queryRunner.query(
                `
                    -- sql
                    UPDATE chart_configs
                    SET ?? = JSON_SET(??, '$.type', ?? ->> '$.chartTypes[0]')
                    WHERE ?? ->> '$.chartTypes' IS NOT NULL
                `,
                [configType, configType, configType, configType]
            )
            await queryRunner.query(
                `
                    -- sql
                    UPDATE chart_configs
                    SET ?? = JSON_SET(??, '$.hasChartTab', FALSE)
                    WHERE
                        ?? ->> '$.chartTypes' IS NOT NULL
                        AND JSON_LENGTH(?? ->> '$.chartTypes') = 0
                `,
                [configType, configType, configType, configType]
            )
        }
    }

    private async removeChartTypesFieldFromConfigs(
        queryRunner: QueryRunner
    ): Promise<void> {
        for (const configType of ["patch", "full"]) {
            await queryRunner.query(
                `
                -- sql
                    UPDATE chart_configs
                    SET ?? = JSON_REMOVE(??, '$.chartTypes')
                `,
                [configType, configType]
            )
        }
    }

    private async updateChartsXParentsViewToUseTypeColumn(
        queryRunner: QueryRunner
    ): Promise<void> {
        // same as the current definition, but uses the new `type` column
        // instead of `full ->> '$.type'`
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

    private async updateChartsXParentsViewToUseTypeField(
        queryRunner: QueryRunner
    ): Promise<void> {
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
                  cc.full ->> '$.type' != 'ScatterPlot'
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
        await this.addChartTypesFieldToConfigs(queryRunner)
        await this.removeTypeAndHasChartTabFields(queryRunner)
        await this.addDerivedChartTypeColumn(queryRunner)
        await this.updateChartsXParentsViewToUseTypeColumn(queryRunner)
        await this.updateSchema(queryRunner, "006")
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await this.updateChartsXParentsViewToUseTypeField(queryRunner)
        await this.removeDerivedTypeColumn(queryRunner)
        await this.addTypeAndHasChartTabFields(queryRunner)
        await this.removeChartTypesFieldFromConfigs(queryRunner)
        await this.updateSchema(queryRunner, "005")
    }
}
