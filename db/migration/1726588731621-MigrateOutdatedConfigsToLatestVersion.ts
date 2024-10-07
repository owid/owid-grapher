import { migrateGrapherConfigToLatestVersion } from "@ourworldindata/grapher"
import { GrapherInterface } from "@ourworldindata/types"
import { MigrationInterface, QueryRunner } from "typeorm"

export class MigrateOutdatedConfigsToLatestVersion1726588731621
    implements MigrationInterface
{
    private migrateConfig(config: Record<string, any>): GrapherInterface {
        try {
            return migrateGrapherConfigToLatestVersion(config)
        } catch {
            // if the migration function throws, then the $schema field
            // is either missing or invalid. when that happens, we assume
            // a schema v1, and try again
            config.$schema =
                "https://files.ourworldindata.org/schemas/grapher-schema.001.json"
            return migrateGrapherConfigToLatestVersion(config)
        }
    }

    public async up(queryRunner: QueryRunner): Promise<void> {
        const outdatedConfigs = await queryRunner.query(
            `-- sql
                SELECT id, patch, full
                FROM chart_configs
                WHERE
                    patch ->> '$.$schema' != 'https://files.ourworldindata.org/schemas/grapher-schema.005.json'
                    OR full ->> '$.$schema' != 'https://files.ourworldindata.org/schemas/grapher-schema.005.json'
            `
        )

        for (const { id, patch, full } of outdatedConfigs) {
            const updatedPatch = this.migrateConfig(JSON.parse(patch))
            const updatedFull = this.migrateConfig(JSON.parse(full))

            await queryRunner.query(
                `-- sql
                    UPDATE chart_configs
                    SET patch = ?, full = ?
                    WHERE id = ?
                `,
                [JSON.stringify(updatedPatch), JSON.stringify(updatedFull), id]
            )
        }
    }

    public async down(): Promise<void> {
        throw new Error(
            "Can't revert migration MigrateOutdatedConfigsToLatestVersion1726588731621"
        )
    }
}
