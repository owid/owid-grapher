import { MigrationInterface, QueryRunner } from "typeorm"

export class CreateDatasetDimensionsByViews1770204012418
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            CREATE VIEW dataset_dimensions_by_variable AS
            SELECT
                v.id AS variableId,
                d.namespace AS datasetNamespace,
                d.version AS datasetVersion,
                d.name AS datasetProduct,
                (
                    SELECT COALESCE(JSON_ARRAYAGG(p.producer), JSON_ARRAY())
                    FROM (
                        SELECT DISTINCT TRIM(o.producer) AS producer
                        FROM origins_variables ov
                            JOIN origins o ON ov.originId = o.id
                        WHERE ov.variableId = v.id
                            AND o.producer IS NOT NULL
                            AND TRIM(o.producer) != ''
                    ) p
                ) AS datasetProducers,
                v.catalogPath AS catalogPath
            FROM variables v
                LEFT JOIN datasets d ON v.datasetId = d.id
        `)

        await queryRunner.query(`-- sql
            CREATE VIEW dataset_dimensions_by_chart AS
            SELECT
                c.id AS chartId,
                (
                    SELECT COALESCE(JSON_ARRAYAGG(ns.datasetNamespace), JSON_ARRAY())
                    FROM (
                        SELECT DISTINCT ddv.datasetNamespace
                        FROM chart_dimensions cd
                            JOIN dataset_dimensions_by_variable ddv
                                ON cd.variableId = ddv.variableId
                        WHERE cd.chartId = c.id
                            AND ddv.datasetNamespace IS NOT NULL
                    ) ns
                ) AS datasetNamespaces,
                (
                    SELECT COALESCE(JSON_ARRAYAGG(vs.datasetVersion), JSON_ARRAY())
                    FROM (
                        SELECT DISTINCT ddv.datasetVersion
                        FROM chart_dimensions cd
                            JOIN dataset_dimensions_by_variable ddv
                                ON cd.variableId = ddv.variableId
                        WHERE cd.chartId = c.id
                            AND ddv.datasetVersion IS NOT NULL
                    ) vs
                ) AS datasetVersions,
                (
                    SELECT COALESCE(JSON_ARRAYAGG(ps.datasetProduct), JSON_ARRAY())
                    FROM (
                        SELECT DISTINCT ddv.datasetProduct
                        FROM chart_dimensions cd
                            JOIN dataset_dimensions_by_variable ddv
                                ON cd.variableId = ddv.variableId
                        WHERE cd.chartId = c.id
                            AND ddv.datasetProduct IS NOT NULL
                    ) ps
                ) AS datasetProducts,
                (
                    SELECT COALESCE(JSON_ARRAYAGG(p.producer), JSON_ARRAY())
                    FROM (
                        SELECT DISTINCT TRIM(o.producer) AS producer
                        FROM chart_dimensions cd
                            JOIN origins_variables ov ON cd.variableId = ov.variableId
                            JOIN origins o ON ov.originId = o.id
                        WHERE cd.chartId = c.id
                            AND o.producer IS NOT NULL
                            AND TRIM(o.producer) != ''
                    ) p
                ) AS datasetProducers
            FROM charts c
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`-- sql
            DROP VIEW IF EXISTS dataset_dimensions_by_chart
        `)

        await queryRunner.query(`-- sql
            DROP VIEW IF EXISTS dataset_dimensions_by_variable
        `)
    }
}
