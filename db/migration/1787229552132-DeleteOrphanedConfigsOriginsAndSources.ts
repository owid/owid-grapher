import { MigrationInterface, QueryRunner } from "typeorm"

/** Delete orphaned rows from `chart_configs`, `origins`, and `sources` */
export class DeleteOrphanedConfigsOriginsAndSources1787229552132 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Delete orphaned chart configs
        const configs = await queryRunner.query(`-- sql
            DELETE cc FROM chart_configs cc
            WHERE NOT EXISTS (
                    SELECT 1 FROM charts c
                    WHERE c.configId = cc.id OR c.patchConfigId = cc.id
                )
                AND NOT EXISTS (
                    SELECT 1 FROM multi_dim_x_chart_configs mdxcc
                    WHERE mdxcc.chartConfigId = cc.id
                )
                AND NOT EXISTS (
                    SELECT 1 FROM narrative_charts nc
                    WHERE nc.chartConfigId = cc.id OR nc.patchConfigId = cc.id
                )
                AND NOT EXISTS (
                    SELECT 1 FROM explorer_views ev
                    WHERE ev.chartConfigId = cc.id
                )
                AND NOT EXISTS (
                    SELECT 1 FROM variables v WHERE v.patchConfigIdETL = cc.id
                )
                AND NOT EXISTS (
                    SELECT 1 FROM multi_dim_redirects mdr
                    WHERE mdr.viewConfigId = cc.id
                )
        `)

        // `origins_variables` is the only way to reach an origin
        const origins = await queryRunner.query(`-- sql
            DELETE FROM origins
            WHERE NOT EXISTS (
                SELECT 1 FROM origins_variables ov WHERE ov.originId = origins.id
            )
        `)

        // ...and `variables.sourceId` the only way to reach a source
        const sources = await queryRunner.query(`-- sql
            DELETE FROM sources
            WHERE NOT EXISTS (
                SELECT 1 FROM variables v WHERE v.sourceId = sources.id
            )
        `)

        console.log(
            `Deleted ${configs.affectedRows} orphaned chart configs, ` +
                `${origins.affectedRows} origins, ${sources.affectedRows} sources`
        )
    }

    public async down(): Promise<void> {
        // Deleted rows can't be brought back
    }
}
