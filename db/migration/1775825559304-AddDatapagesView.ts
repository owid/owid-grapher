import { MigrationInterface, QueryRunner } from "typeorm"

export class AddDatapagesView1775825559304 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            CREATE VIEW datapages AS
            WITH y_dimensions AS (
                SELECT
                    chartId,
                    variableId,
                    ROW_NUMBER() OVER (PARTITION BY chartId ORDER BY \`order\`) AS rn
                FROM chart_dimensions
                WHERE property = 'y'
            ),
            y_counts AS (
                SELECT chartId, COUNT(*) AS num_y
                FROM chart_dimensions
                WHERE property = 'y'
                GROUP BY chartId
            ),
            has_x_dimension AS (
                SELECT DISTINCT chartId
                FROM chart_dimensions
                WHERE property = 'x'
            )
            SELECT
                c.id AS chartId,
                yd.variableId AS variableId
            FROM charts c
            JOIN chart_configs cc ON cc.id = c.configId
            JOIN y_dimensions yd ON yd.chartId = c.id AND yd.rn = 1
            JOIN y_counts yc ON yc.chartId = c.id
            LEFT JOIN has_x_dimension hx ON hx.chartId = c.id
            JOIN variables v ON v.id = yd.variableId
            WHERE
                c.forceDatapage = 1
                OR (
                    yc.num_y = 1
                    AND NOT (cc.chartType = 'ScatterPlot' AND hx.chartId IS NOT NULL)
                    AND v.schemaVersion >= 2
                    AND (
                        (v.descriptionShort IS NOT NULL AND v.descriptionShort != '')
                        OR (v.descriptionProcessing IS NOT NULL AND v.descriptionProcessing != '')
                        OR (v.descriptionKey IS NOT NULL AND v.descriptionKey != '' AND v.descriptionKey != '[]')
                        OR (v.descriptionFromProducer IS NOT NULL AND v.descriptionFromProducer != '')
                        OR (v.titlePublic IS NOT NULL AND v.titlePublic != '')
                    )
                )
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP VIEW IF EXISTS datapages`)
    }
}
