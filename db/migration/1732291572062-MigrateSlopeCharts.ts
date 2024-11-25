import { MigrationInterface, QueryRunner } from "typeorm"

export class MigrateSlopeCharts1732291572062 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // create a temporary table that lists all slope charts and their
        // corresponding line charts (there might be multiple)
        await queryRunner.query(`
            -- sql
            CREATE TABLE slope_line_charts (
                variableId integer NOT NULL,
                slopeChartId integer NOT NULL,
                slopeChartConfigId varchar(255) NOT NULL,
                slopeChartSelectedEntityNames JSON,
                lineChartId integer,
                lineChartConfigId varchar(255)
            )
        `)
        await queryRunner.query(`
            INSERT INTO slope_line_charts (
                variableId,
                slopeChartId,
                slopeChartConfigId,
                slopeChartSelectedEntityNames,
                lineChartId,
                lineChartConfigId
            )
            SELECT * FROM (
                WITH line_charts AS (
                    SELECT
                        c.id,
                        c.configId,
                        cc.full ->> '$.dimensions[0].variableId' as variableId
                    FROM charts c
                    JOIN chart_configs cc ON c.configId = cc.id
                    WHERE
                        cc.chartType = 'LineChart'
                        AND JSON_LENGTH(cc.full, '$.dimensions') = 1
                        AND cc.full ->> '$.isPublished' = 'true'
                ), slope_charts AS (
                    SELECT
                        c.id,
                        c.configId,
                        cc.full ->> '$.dimensions[0].variableId' as variableId,
                        cc.full -> '$.selectedEntityNames' as selectedEntityNames
                    FROM charts c
                    JOIN chart_configs cc ON c.configId = cc.id
                    WHERE
                        cc.chartType = 'SlopeChart'
                        AND cc.full ->> '$.isPublished' = 'true'
                )
                SELECT
                    sc.variableId AS variableId,
                    sc.id AS slopeChartId,
                    sc.configId AS slopeChartConfigId,
                    sc.selectedEntityNames AS slopeChartSelectedEntityNames,
                    lc.id AS lineChartId,
                    lc.configId AS lineChartConfigId
                FROM slope_charts sc
                LEFT JOIN line_charts lc ON lc.variableId = sc.variableId
            ) AS derived_table;
        `)

        // STAND-ALONE SLOPE CHARTS

        // make sure entity selection is not disabled
        await queryRunner.query(`
            -- sql
            UPDATE chart_configs cc
            JOIN slope_line_charts slc ON slc.slopeChartConfigId = cc.id
            SET
                cc.patch = JSON_SET(cc.patch, '$.addCountryMode', 'add-country'),
                cc.full = JSON_SET(cc.full, '$.addCountryMode', 'add-country')
            WHERE
                slc.lineChartId IS NULL
                AND (
                    cc.full ->> '$.addCountryMode' = 'disabled'
                    OR cc.full ->> '$.addCountryMode' = 'change-country'
                )
        `)

        // make sure the line legend isn't hidden
        await queryRunner.query(`
            -- sql
            UPDATE chart_configs cc
            JOIN slope_line_charts slc ON slc.slopeChartConfigId = cc.id
            SET
                cc.patch = JSON_SET(cc.patch, '$.hideLegend', false),
                cc.full = JSON_SET(cc.full, '$.hideLegend', false)
            WHERE
                slc.lineChartId IS NULL
                AND cc.full ->> '$.hideLegend' = 'true'
        `)

        // for stand-alone slope charts that don't currently have any selected
        // entities, just pick a random set of five entities.
        // it's possible to end up with entities that don't have data for the
        // selected years. after running the migration, I'll go through each
        // slope chart and correct the selected entities manually if necessary.
        await queryRunner.query(`
            -- sql
            WITH selected_entities AS (
                WITH ranked_entities AS (
                    SELECT
                        slc.slopeChartId AS chartId,
                        slc.slopeChartConfigId AS configId,
                        cxe.entityId,
                        e.name AS entityName,
                        ROW_NUMBER() OVER (PARTITION BY chartId ORDER BY RAND()) AS randomIndex
                    FROM slope_line_charts slc
                    JOIN charts_x_entities cxe ON cxe.chartId = slc.slopeChartId
                    JOIN entities e ON e.id = cxe.entityId
                    WHERE
                        slc.lineChartId IS NULL
                        AND (
                            slc.slopeChartSelectedEntityNames IS NULL
                            OR JSON_LENGTH(slc.slopeChartSelectedEntityNames) = 0
                        )
                )
                SELECT chartId, configId, JSON_ARRAYAGG(entityName) as selectedEntityNames
                FROM ranked_entities
                WHERE randomIndex <= 4
                GROUP BY chartId, configId
            )
            UPDATE chart_configs cc
            JOIN selected_entities se ON se.configId = cc.id
            SET
                cc.patch = JSON_SET(cc.patch, '$.selectedEntityNames', se.selectedEntityNames),
                cc.full = JSON_SET(cc.full, '$.selectedEntityNames', se.selectedEntityNames)
        `)

        // LINE+SLOPE CHARTS

        // add a slope tab to all line charts that have a corresponding slope
        // chart (excluded are slope charts that have been matched with more
        // than one line chart)
        await queryRunner.query(`
            WITH deduped_slope_line_charts AS (
                SELECT slopeChartId, COUNT(*) count
                FROM slope_line_charts
                GROUP BY slopeChartId
                HAVING count = 1
            )
            UPDATE chart_configs cc
            JOIN slope_line_charts slc ON slc.lineChartConfigId = cc.id
            JOIN deduped_slope_line_charts dslc ON dslc.slopeChartId = slc.slopeChartId
            SET
                cc.patch = JSON_SET(cc.patch, '$.chartTypes', JSON_ARRAY('LineChart', 'SlopeChart')),
                cc.full = JSON_SET(cc.full, '$.chartTypes', JSON_ARRAY('LineChart', 'SlopeChart'))
        `)

        await queryRunner.query(`DROP TABLE slope_line_charts`)
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    public async down(): Promise<void> {}
}
