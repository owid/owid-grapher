import { MigrationInterface, QueryRunner } from "typeorm"

import { entityNameById } from "./data/entityNameById.js"
import { GrapherInterface } from "@ourworldindata/grapher"

interface GrapherInterfaceBeforeMigration extends GrapherInterface {
    selectedEntityIds?: number[]
}

export class MigrateSelectedEntityIds1681310285750
    implements MigrationInterface
{
    static transformConfig(
        legacyConfig: GrapherInterfaceBeforeMigration | undefined
    ): GrapherInterface {
        if (!legacyConfig || legacyConfig.selectedEntityNames !== null)
            return legacyConfig ?? {}

        const selectedEntityNames = legacyConfig.selectedEntityIds?.map(
            (id) => {
                const name = entityNameById[id]
                if (!name) throw new Error(`Entity name not found for id ${id}`)
                return name
            }
        )

        return {
            ...legacyConfig,
            selectedEntityNames,
            selectedEntityIds: undefined,
        }
    }

    public async up(queryRunner: QueryRunner): Promise<void> {
        const tables = {
            charts: "config",
            chart_revisions: "config",
            suggested_chart_revisions: "suggestedConfig",
        }

        for (const [tableName, columnName] of Object.entries(tables)) {
            const rows = await queryRunner.query(
                `
                SELECT id, ${columnName} AS json
                FROM ${tableName}
                WHERE JSON_CONTAINS_PATH(${columnName}, 'one', '$.selectedEntityIds')
                `
            )
            for (const row of rows) {
                const config = JSON.parse(
                    row.json
                ) as GrapherInterfaceBeforeMigration
                const newConfig =
                    MigrateSelectedEntityIds1681310285750.transformConfig(
                        config
                    )
                await queryRunner.query(
                    `UPDATE ${tableName} SET ${columnName} = ? WHERE id = ?`,
                    [JSON.stringify(newConfig), row.id]
                )
            }
        }
    }

    public async down(): Promise<void> {
        // no going back!
    }
}
