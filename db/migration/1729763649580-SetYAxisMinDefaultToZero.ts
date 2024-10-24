import { defaultGrapherConfig } from "@ourworldindata/grapher"
import { mergeGrapherConfigs } from "@ourworldindata/utils"
import { MigrationInterface, QueryRunner } from "typeorm"

export class SetYAxisMinDefaultToZero1729763649580
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        // when inheritance is disabled, set yAxis.min explicitly to "auto"
        // for charts that used to rely on "auto" being the default
        await queryRunner.query(`
            -- sql
            UPDATE chart_configs cc
            JOIN charts c ON cc.id = c.configId
            SET
                -- using JSON_MERGE_PATCH instead of JSON_SET in case yAxis doesn't exist
                cc.patch = JSON_MERGE_PATCH(cc.patch, '{"yAxis":{"min":"auto"}}'),
                cc.full = JSON_MERGE_PATCH(cc.full, '{"yAxis":{"min":"auto"}}')
            WHERE
                cc.full ->> '$.type' = 'LineChart'
                AND cc.patch ->> '$.yAxis.min' IS NULL
                AND c.isInheritanceEnabled IS FALSE
        `)

        // set yAxis.min to "auto" for etl-authored configs for configs
        // that used to rely on "auto" being the default
        await queryRunner.query(`
             -- sql
             UPDATE chart_configs cc
             JOIN variables v ON cc.id = v.grapherConfigIdETL
             SET
                 cc.patch = JSON_MERGE_PATCH(cc.patch, '{"yAxis":{"min":"auto"}}'),
                 cc.full = JSON_MERGE_PATCH(cc.full, '{"yAxis":{"min":"auto"}}')
             WHERE
                COALESCE(cc.patch ->> '$.type', 'LineChart') = 'LineChart'
                AND cc.patch ->> '$.yAxis.min' IS NULL
         `)

        // update admin-authored configs (we don't currently have any in use
        // but included for completeness)
        const indicatorConfigs = await queryRunner.query(`
             -- sql
             SELECT
                 v.id AS variableId,
                 cc_admin.id AS adminConfigId,
                 cc_admin.patch AS adminConfig,
                 cc_etl.patch AS etlConfig
             FROM variables v
             JOIN chart_configs cc_admin ON cc_admin.id = v.grapherConfigIdAdmin
             JOIN chart_configs cc_etl ON cc_etl.id = v.grapherConfigIdETL
             WHERE
                COALESCE(cc_etl.patch ->> '$.type', 'LineChart') = 'LineChart'
                AND cc_etl.patch ->> '$.yAxis.min' = 'auto'
         `)

        for (const indicator of indicatorConfigs) {
            const fullConfig = mergeGrapherConfigs(
                JSON.parse(indicator.etlConfig),
                JSON.parse(indicator.adminConfig)
            )

            await queryRunner.query(
                `
                    -- sql
                    UPDATE chart_configs cc
                    SET cc.full = ?
                    WHERE cc.id = ?
                `,
                [JSON.stringify(fullConfig), indicator.adminConfigId]
            )
        }

        // Update the full configs of all charts that inherit from an indicator
        const charts = await queryRunner.query(`
             -- sql
             SELECT
                 cc.id AS configId,
                 cc.patch AS patchConfig,
                 cc_etl.patch AS etlConfig,
                 cc_admin.patch AS adminConfig
             FROM charts c
             JOIN chart_configs cc ON cc.id = c.configId
             JOIN charts_x_parents p ON p.chartId = c.id
             JOIN variables v ON v.id = p.variableId
             LEFT JOIN chart_configs cc_etl ON cc_etl.id = v.grapherConfigIdETL
             LEFT JOIN chart_configs cc_admin ON cc_admin.id = v.grapherConfigIdAdmin
             WHERE c.isInheritanceEnabled IS TRUE
         `)

        for (const chart of charts) {
            const patchConfig = JSON.parse(chart.patchConfig)
            const etlConfig = chart.etlConfig ? JSON.parse(chart.etlConfig) : {}
            const adminConfig = chart.adminConfig
                ? JSON.parse(chart.adminConfig)
                : {}

            // if neither the indicator chart nor the patch config specified a yAxis
            // min value, then the chart used to rely on the default "auto" value
            if (
                etlConfig?.yAxis?.min === undefined &&
                patchConfig.yAxis?.min === undefined
            ) {
                patchConfig.yAxis = patchConfig.yAxis ?? {}
                patchConfig.yAxis.min = "auto"
            }

            const fullConfig = mergeGrapherConfigs(
                defaultGrapherConfig,
                etlConfig,
                adminConfig,
                patchConfig
            )

            await queryRunner.query(
                `
                    -- sql
                    UPDATE chart_configs cc
                    SET cc.full = ?
                    WHERE cc.id = ?
                `,
                [JSON.stringify(fullConfig), chart.configId]
            )
        }
    }

    public async down(): Promise<void> {
        throw new Error(
            "Migration SetYAxisMinDefaultToZero1729763649580 can't be reverted"
        )
    }
}
