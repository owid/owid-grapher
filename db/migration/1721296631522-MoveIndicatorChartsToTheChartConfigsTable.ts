import { defaultGrapherConfig } from "@ourworldindata/grapher"
import { DimensionProperty, GrapherInterface } from "@ourworldindata/types"
import { mergeGrapherConfigs, omit } from "@ourworldindata/utils"
import { MigrationInterface, QueryRunner } from "typeorm"

export class MoveIndicatorChartsToTheChartConfigsTable1721296631522
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE variables
                ADD COLUMN grapherConfigIdAdmin binary(16) UNIQUE AFTER sort,
                ADD COLUMN grapherConfigIdETL binary(16) UNIQUE AFTER grapherConfigIdAdmin,
                ADD CONSTRAINT fk_variables_grapherConfigIdAdmin
                    FOREIGN KEY (grapherConfigIdAdmin)
                    REFERENCES chart_configs (id)
                    ON DELETE RESTRICT
                    ON UPDATE RESTRICT,
                ADD CONSTRAINT fk_variables_grapherConfigIdETL
                    FOREIGN KEY (grapherConfigIdETL)
                    REFERENCES chart_configs (id)
                    ON DELETE RESTRICT
                    ON UPDATE RESTRICT
        `)

        // note that we copy the ETL-authored configs to the chart_configs table,
        // but drop the admin-authored configs

        const variables = await queryRunner.query(`-- sql
            SELECT id, grapherConfigETL
            FROM variables
            WHERE grapherConfigETL IS NOT NULL
        `)

        for (const { id: variableId, grapherConfigETL } of variables) {
            let config: GrapherInterface = JSON.parse(grapherConfigETL)

            // if the config has no schema, assume it's the default version
            if (!config.$schema) {
                config.$schema = defaultGrapherConfig.$schema
            }

            // check if the given dimensions are correct
            if (config.dimensions && config.dimensions.length >= 1) {
                // make sure there is only a single entry
                config.dimensions = config.dimensions.slice(0, 1)
                // make sure the variable id matches
                config.dimensions[0].variableId = variableId
            }

            // fill dimensions if not given to make the config plottable
            if (!config.dimensions || config.dimensions.length === 0) {
                config.dimensions = [
                    { property: DimensionProperty.y, variableId },
                ]
            }

            // we have v3 configs in the database (the current version is v4);
            // turn these into v4 configs by removing the `data` property
            // which was the breaking change that lead to v4
            // (we don't have v2 or v1 configs in the database, so we don't need to handle those)
            if (
                config.$schema ===
                "https://files.ourworldindata.org/schemas/grapher-schema.003.json"
            ) {
                config = omit(config, "data")
                config.$schema = defaultGrapherConfig.$schema
            }

            // insert config into the chart_configs table
            const configId = await getBinaryUUID(queryRunner)
            await queryRunner.query(
                `-- sql
                    INSERT INTO chart_configs (id, patch, full)
                    VALUES (?, ?, ?)
                `,
                [configId, JSON.stringify(config), JSON.stringify(config)]
            )

            // update reference in the variables table
            await queryRunner.query(
                `-- sql
                    UPDATE variables
                    SET grapherConfigIdETL = ?
                    WHERE id = ?
                `,
                [configId, variableId]
            )
        }

        // drop `grapherConfigAdmin` and `grapherConfigETL` columns
        await queryRunner.query(`-- sql
            ALTER TABLE variables
                DROP COLUMN grapherConfigAdmin,
                DROP COLUMN grapherConfigETL
        `)

        // add a view that lists all charts that inherit from an indicator
        await queryRunner.query(`-- sql
          CREATE VIEW inheriting_charts AS (
            WITH y_dimensions AS (
              SELECT
                *
              FROM
                chart_dimensions
              WHERE
                property = 'y'
            ),
            single_y_indicator_charts As (
              SELECT
                c.id as chartId,
                cc.patch as patchConfig,
                max(yd.variableId) as variableId
              FROM
                charts c
                JOIN chart_configs cc ON cc.id = c.configId
                JOIN y_dimensions yd ON c.id = yd.chartId
              WHERE
                cc.full ->> '$.type' != 'ScatterPlot'
              GROUP BY
                c.id
              HAVING
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

        // update the full column of every chart that inherits from an indicator
        const inheritancePairs = await queryRunner.query(`-- sql
            SELECT
                ic.chartId,
                ic.variableId,
                cc_chart.patch AS chartPatch,
                cc_variable.patch AS variablePatch
            FROM inheriting_charts ic
            JOIN chart_configs cc_chart ON cc_chart.id = (
                SELECT configId FROM charts
                WHERE id = ic.chartId
            )
            JOIN chart_configs cc_variable ON cc_variable.id = (
                SELECT grapherConfigIdETL FROM variables
                WHERE id = ic.variableId
            )
        `)
        for (const pair of inheritancePairs) {
            const fullChartConfig = mergeGrapherConfigs(
                defaultGrapherConfig,
                JSON.parse(pair.variablePatch),
                JSON.parse(pair.chartPatch)
            )
            await queryRunner.query(
                `-- sql
                    UPDATE chart_configs
                    SET full = ?
                    WHERE id = (
                        SELECT configId FROM charts
                        WHERE id = ?
                    )
                `,
                [JSON.stringify(fullChartConfig), pair.chartId]
            )
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // drop view
        await queryRunner.query(`-- sql
            DROP VIEW inheriting_charts
        `)

        // add back the `grapherConfigAdmin` and `grapherConfigETL` columns
        await queryRunner.query(`-- sql
          ALTER TABLE variables
              ADD COLUMN grapherConfigAdmin json AFTER sort,
              ADD COLUMN grapherConfigETL json AFTER grapherConfigAdmin
        `)

        // copy configs from the chart_configs table to the variables table
        await queryRunner.query(`-- sql
            UPDATE variables v
            JOIN chart_configs cc ON v.grapherConfigIdETL = cc.id
            SET v.grapherConfigETL = cc.patch
        `)

        // remove constraints on the `grapherConfigIdAdmin` and `grapherConfigIdETL` columns
        await queryRunner.query(`-- sql
            ALTER TABLE variables
                DROP CONSTRAINT fk_variables_grapherConfigIdAdmin,
                DROP CONSTRAINT fk_variables_grapherConfigIdETL
        `)

        // drop rows from the chart_configs table
        await queryRunner.query(`-- sql
            DELETE FROM chart_configs
            WHERE id IN (
                SELECT grapherConfigIdETL FROM variables
                WHERE grapherConfigIdETL IS NOT NULL
            )
        `)

        // remove the `grapherConfigIdAdmin` and `grapherConfigIdETL` columns
        await queryRunner.query(`-- sql
            ALTER TABLE variables
                DROP COLUMN grapherConfigIdAdmin,
                DROP COLUMN grapherConfigIdETL
        `)

        // restore full configs of standalone charts
        const charts = await queryRunner.query(`-- sql
            SELECT id AS configId, patch FROM chart_configs
        `)
        for (const chart of charts) {
            const fullConfig = mergeGrapherConfigs(
                defaultGrapherConfig,
                JSON.parse(chart.patch)
            )
            await queryRunner.query(
                `-- sql
                    UPDATE chart_configs
                    SET full = ?
                    WHERE id = ?
                `,
                [JSON.stringify(fullConfig), chart.configId]
            )
        }
    }
}

const getBinaryUUID = async (queryRunner: QueryRunner): Promise<Buffer> => {
    const rows = await queryRunner.query(`SELECT UUID_TO_BIN(UUID(), 1) AS id`)
    return rows[0].id
}
