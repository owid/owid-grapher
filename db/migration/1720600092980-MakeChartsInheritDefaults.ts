import { MigrationInterface, QueryRunner } from "typeorm"
import { diffGrapherConfigs, mergeGrapherConfigs } from "@ourworldindata/utils"
import { defaultGrapherConfig } from "@ourworldindata/grapher"

export class MakeChartsInheritDefaults1720600092980
    implements MigrationInterface
{
    public async up(queryRunner: QueryRunner): Promise<void> {
        const charts = (await queryRunner.query(
            `-- sql
                SELECT id, patch as config FROM chart_configs
            `
        )) as { id: string; config: string }[]

        for (const chart of charts) {
            const originalConfig = JSON.parse(chart.config)

            // if the schema version is missing, assume it's the latest
            if (!originalConfig["$schema"]) {
                originalConfig["$schema"] = defaultGrapherConfig["$schema"]
            }

            const patchConfig = diffGrapherConfigs(
                originalConfig,
                defaultGrapherConfig
            )
            const fullConfig = mergeGrapherConfigs(
                defaultGrapherConfig,
                patchConfig
            )

            await queryRunner.query(
                `-- sql
                    UPDATE chart_configs
                    SET
                        patch = ?,
                        full = ?
                    WHERE id = ?
                `,
                [
                    JSON.stringify(patchConfig),
                    JSON.stringify(fullConfig),
                    chart.id,
                ]
            )
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // we can't recover the original configs,
        // but the patched one is the next best thing
        await queryRunner.query(
            `-- sql
                UPDATE chart_configs
                SET full = patch
            `
        )
    }
}
