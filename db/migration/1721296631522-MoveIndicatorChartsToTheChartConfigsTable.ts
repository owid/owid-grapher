import { MigrationInterface, QueryRunner } from "typeorm"
import { uuidv7 } from "uuidv7"

export class MoveIndicatorChartsToTheChartConfigsTable1721296631522
    implements MigrationInterface
{
    private async validateGrapherConfigETLs(
        queryRunner: QueryRunner
    ): Promise<void> {
        // we have v3 configs in the database (the current version is v4);
        // turn these into v4 configs by removing the `data` property
        // which was the breaking change that lead to v4
        // (we don't have v2 or v1 configs in the database, so we don't need to handle those)
        await queryRunner.query(
            `-- sql
                UPDATE variables
                SET grapherConfigETL = JSON_SET(
                    JSON_REMOVE(grapherConfigETL, '$.data'),
                    '$.$schema',
                    'https://files.ourworldindata.org/schemas/grapher-schema.004.json'
                )
                WHERE
                    grapherConfigETL IS NOT NULL
                    AND grapherConfigETL ->> '$.$schema' = 'https://files.ourworldindata.org/schemas/grapher-schema.003.json'
              `
        )

        // if the config has no schema, assume it's the default version
        await queryRunner.query(
            `-- sql
              UPDATE variables
              SET grapherConfigETL = JSON_SET(
                  grapherConfigETL,
                  '$.$schema',
                  'https://files.ourworldindata.org/schemas/grapher-schema.004.json'
              )
              WHERE
                  grapherConfigETL IS NOT NULL
                  AND grapherConfigETL ->> '$.$schema' IS NULL
            `
        )

        // fill dimensions to make the config plottable
        // (at the time of writing, the dimensions field is empty for all configs)
        await queryRunner.query(
            `-- sql
              UPDATE variables
              SET grapherConfigETL = JSON_SET(
                  grapherConfigETL,
                  '$.dimensions',
                  JSON_ARRAY(JSON_OBJECT('variableId', id, 'property', 'y'))
              )
              WHERE grapherConfigETL IS NOT NULL
          `
        )
    }

    private async moveGrapherConfigETLsToChartConfigsTable(
        queryRunner: QueryRunner
    ): Promise<void> {
        // ~ 68000 entries at the time of writing
        const variables: { id: number }[] = await queryRunner.query(`-- sql
            SELECT id
            FROM variables
            WHERE grapherConfigETL IS NOT NULL
        `)

        // early return if there are no configs to migrate
        // (this can happen if the migration is run for an empty test database)
        if (variables.length === 0) return

        // generate UUIDs for every config
        const ids = variables.map((v) => ({
            variableId: v.id,
            uuid: uuidv7(),
        }))

        // insert a new row for each config with dummy values for the config fields
        await queryRunner.query(
            `-- sql
                INSERT INTO chart_configs (id, patch, full)
                VALUES ?
            `,
            [ids.map(({ uuid }) => [uuid, "{}", "{}"])]
        )

        // add a reference to the chart_configs uuid in the variables table
        const variablesUpdateValues = ids
            .map(
                ({ variableId, uuid }) =>
                    `(${variableId},'${uuid}',unit,coverage,timespan,datasetId,display)`
            )
            .join(",")
        await queryRunner.query(`-- sql
            INSERT INTO variables (id, grapherConfigIdETL, unit, coverage, timespan, datasetId, display)
            VALUES ${variablesUpdateValues}
            ON DUPLICATE KEY UPDATE grapherConfigIdETL=VALUES(grapherConfigIdETL)
        `)

        // copy configs from the variables table to the chart_configs table
        await queryRunner.query(`-- sql
            UPDATE chart_configs
            JOIN variables ON variables.grapherConfigIdETL = chart_configs.id
            SET
                patch = variables.grapherConfigETL,
                full = variables.grapherConfigETL
        `)
    }

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            ALTER TABLE variables
                ADD COLUMN grapherConfigIdAdmin char(36) UNIQUE AFTER sort,
                ADD COLUMN grapherConfigIdETL char(36) UNIQUE AFTER grapherConfigIdAdmin,
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

        await queryRunner.query(`-- sql
            ALTER TABLE charts
                ADD COLUMN parentVariableId int AFTER configId,
                ADD CONSTRAINT fk_charts_parentVariableId
                    FOREIGN KEY (parentVariableId)
                    REFERENCES variables (id)
                    ON DELETE RESTRICT
                    ON UPDATE RESTRICT
        `)

        // note that we copy the ETL-authored configs to the chart_configs table,
        // but drop the admin-authored configs

        // first, make sure all given grapherConfigETLs are valid
        await this.validateGrapherConfigETLs(queryRunner)

        // then, move all grapherConfigETLs to the chart_configs table
        await this.moveGrapherConfigETLsToChartConfigsTable(queryRunner)

        // drop `grapherConfigAdmin` and `grapherConfigETL` columns
        await queryRunner.query(`-- sql
            ALTER TABLE variables
                DROP COLUMN grapherConfigAdmin,
                DROP COLUMN grapherConfigETL
        `)

        // add a view that lists all charts that inherit from an indicator
        await queryRunner.query(`-- sql
          CREATE VIEW inheritance_variables_x_charts AS (
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
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // drop view
        await queryRunner.query(`-- sql
            DROP VIEW inheritance_variables_x_charts
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
    }
}
