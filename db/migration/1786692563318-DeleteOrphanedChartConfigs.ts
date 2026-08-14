import { MigrationInterface, QueryRunner } from "typeorm"

export class DeleteOrphanedChartConfigs1786692563318 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        const result = await queryRunner.query(`-- sql
            DELETE cc FROM chart_configs cc
            WHERE NOT EXISTS (
                    SELECT 1 FROM charts c
                    WHERE c.configId = cc.id OR c.patchConfigId = cc.id
                )
                AND NOT EXISTS (
                    SELECT 1 FROM multi_dim_x_chart_configs mdxcc
                    WHERE mdxcc.chartConfigId = cc.id
                        OR mdxcc.patchConfigId = cc.id
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
                AND NOT EXISTS (
                    SELECT 1 FROM multi_dim_view_dimensions mdvd
                    WHERE mdvd.chartConfigId = cc.id
                )
                AND NOT EXISTS (
                    SELECT 1 FROM explorer_view_dimensions evd
                    WHERE evd.chartConfigId = cc.id
                )
        `)

        console.log(`Deleted ${result.affectedRows} orphaned chart configs`)
    }

    public async down(_: QueryRunner): Promise<void> {
        // No-op: we cannot restore deleted chart configs
    }
}
