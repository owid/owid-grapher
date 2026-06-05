import { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Recreate the `datapages` view without window-function CTEs.
 *
 * MySQL cannot merge views that contain window functions or derived tables,
 * so `SELECT ... FROM datapages WHERE chartId = ?` materialized the whole
 * view (a scan over all of chart_dimensions, three times) on every call.
 * The baker runs this query once per chart (~7k times per bake), which made
 * baking painfully slow.
 *
 * Expressing the same logic with correlated subqueries keeps the view
 * mergeable (ALGORITHM=MERGE), so the chartId predicate is pushed down and
 * each lookup becomes a handful of indexed reads.
 *
 * The result set is identical to the previous definition, with one
 * improvement: ties on `order` among y-dimensions are now broken
 * deterministically by id (ROW_NUMBER previously picked an arbitrary row).
 */
export class MakeDatapagesViewMergeable1780649349564
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP VIEW IF EXISTS datapages`)
        await queryRunner.query(`-- sql
            CREATE VIEW datapages AS
            SELECT
                c.id AS chartId,
                cd.variableId AS variableId
            FROM charts c
            JOIN chart_configs cc ON cc.id = c.configId
            JOIN chart_dimensions cd ON cd.chartId = c.id AND cd.property = 'y'
            JOIN variables v ON v.id = cd.variableId
            WHERE
                -- first y-dimension by \`order\`
                cd.id = (
                    SELECT cd2.id
                    FROM chart_dimensions cd2
                    WHERE cd2.chartId = c.id AND cd2.property = 'y'
                    ORDER BY cd2.\`order\`, cd2.id
                    LIMIT 1
                )
                AND (
                    c.forceDatapage = 1
                    OR (
                        (
                            SELECT COUNT(*)
                            FROM chart_dimensions cd3
                            WHERE cd3.chartId = c.id AND cd3.property = 'y'
                        ) = 1
                        AND NOT (
                            cc.chartType = 'ScatterPlot'
                            AND EXISTS (
                                SELECT 1
                                FROM chart_dimensions cd4
                                WHERE cd4.chartId = c.id AND cd4.property = 'x'
                            )
                        )
                        AND v.schemaVersion >= 2
                        AND (
                            (v.descriptionShort IS NOT NULL AND v.descriptionShort != '')
                            OR (v.descriptionProcessing IS NOT NULL AND v.descriptionProcessing != '')
                            OR (v.descriptionKey IS NOT NULL AND v.descriptionKey != '' AND v.descriptionKey != '[]')
                            OR (v.descriptionFromProducer IS NOT NULL AND v.descriptionFromProducer != '')
                            OR (v.titlePublic IS NOT NULL AND v.titlePublic != '')
                        )
                    )
                )
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP VIEW IF EXISTS datapages`)
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
}
