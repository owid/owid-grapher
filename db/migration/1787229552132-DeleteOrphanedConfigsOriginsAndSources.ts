import { MigrationInterface, QueryRunner } from "typeorm"

/** Delete orphaned rows from `chart_configs`, `origins`, and `sources` */
export class DeleteOrphanedConfigsOriginsAndSources1787229552132 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Every foreign key into `chart_configs`
        await queryRunner.query(`-- sql
            DELETE FROM chart_configs
            WHERE NOT EXISTS (
                    SELECT 1 FROM charts c
                    WHERE c.configId = chart_configs.id
                )
                AND NOT EXISTS (
                    SELECT 1 FROM explorer_views ev
                    WHERE ev.chartConfigId = chart_configs.id
                )
                AND NOT EXISTS (
                    SELECT 1 FROM multi_dim_redirects mdr
                    WHERE mdr.viewConfigId = chart_configs.id
                )
                AND NOT EXISTS (
                    SELECT 1 FROM multi_dim_x_chart_configs mdxcc
                    WHERE mdxcc.chartConfigId = chart_configs.id
                )
                AND NOT EXISTS (
                    SELECT 1 FROM narrative_charts nc
                    WHERE nc.chartConfigId = chart_configs.id
                )
                AND NOT EXISTS (
                    SELECT 1 FROM variables v
                    WHERE v.grapherConfigIdETL = chart_configs.id
                        OR v.grapherConfigIdAdmin = chart_configs.id
                )
        `)

        // `origins_variables` is the only way to reach an origin
        await queryRunner.query(`-- sql
            DELETE FROM origins
            WHERE NOT EXISTS (
                SELECT 1 FROM origins_variables ov WHERE ov.originId = origins.id
            )
        `)

        // ...and `variables.sourceId` the only way to reach a source
        await queryRunner.query(`-- sql
            DELETE FROM sources
            WHERE NOT EXISTS (
                SELECT 1 FROM variables v WHERE v.sourceId = sources.id
            )
        `)
    }

    public async down(): Promise<void> {
        // Deleted rows can't be brought back
    }
}
