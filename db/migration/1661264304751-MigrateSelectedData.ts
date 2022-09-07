import { MigrationInterface, QueryRunner } from "typeorm"
import { excludeUndefined, sortBy, uniq } from "../../clientUtils/Util.js"

import { entityNameById } from "./data/entityNameById.js"

import { GrapherInterface } from "../../grapher/core/GrapherInterface.js"
import { ChartTypeName } from "../../grapher/core/GrapherConstants.js"

/**
 * Migrate the legacy `selectedData` and get rid of it.
 *
 * The presence of the legacy `selectedData` property has caused various hard-to-trace problems in the past, especially
 * around editing chart dimensions and reordering dimensions.
 *
 * In particular, `selectedData` was still being used for four things:
 * 1. select variables to show
 * 2. select entities to show by default
 * 3. specify the order of dimensions
 * 4. specify colors for dimensions and entities
 *
 * However, we also have other ways for all of these things, and sometimes the legacy config could clash with the other
 * config properties.
 * For example, there are several charts where dimensions were added to a chart but are not displayed, because there was
 * a `selectedData` property and it didn't include the new dimension; there is no real way in our admin to fix this.
 */

interface EntitySelection {
    entityId: number
    index: number // Which dimension the entity is from
    color?: string
}

interface GrapherInterfaceBeforeMigration extends GrapherInterface {
    selectedData?: EntitySelection[]
}

export class MigrateSelectedData1661264304751 implements MigrationInterface {
    name = "MigrateSelectedData1661264304751"

    static transformConfig(
        legacyConfig: GrapherInterfaceBeforeMigration | undefined
    ): GrapherInterface {
        if (!legacyConfig?.selectedData?.length) {
            if (legacyConfig) delete legacyConfig.selectedData
            return legacyConfig ?? {}
        }

        const newConfig = { ...legacyConfig } as GrapherInterfaceBeforeMigration

        // Migrate selected entities
        newConfig.selectedEntityIds = uniq(
            legacyConfig.selectedData.map((row) => row.entityId)
        ) // We need to do uniq because an EntityName may appear multiple times in the old graphers, once for each dimension

        // Migrate dimension and entity colors.
        // Iterate through the reversed array because in case of multiple entries for one entity, the last one applies.
        legacyConfig.selectedData
            .slice()
            .reverse()
            .forEach((item) => {
                if (item.entityId && item.color) {
                    // migrate entity color
                    if (!legacyConfig.selectedEntityColors) {
                        newConfig.selectedEntityColors =
                            newConfig.selectedEntityColors ?? {}
                        const entityName = entityNameById[item.entityId]
                        if (entityName) {
                            newConfig.selectedEntityColors[entityName] ??=
                                item.color
                        }
                    }

                    // migrate dimension color
                    const dimension = newConfig.dimensions?.[item.index]
                    if (dimension?.variableId) {
                        dimension.display = dimension.display ?? {}
                        dimension.display.color ??= item.color
                    }
                }
            })

        const migrateDimensionsTypes: ChartTypeName[] = [
            ChartTypeName.Marimekko,
            ChartTypeName.StackedArea,
            ChartTypeName.StackedBar,
            ChartTypeName.StackedDiscreteBar,
        ]

        // Migrate order of dimensions.
        // Only applied to stacked charts, because only they rely on `yColumnSlugsInSelectionOrder`.
        if (
            legacyConfig.type &&
            migrateDimensionsTypes.includes(legacyConfig.type)
        ) {
            const variableIDsInSelectionOrder = excludeUndefined(
                legacyConfig.selectedData?.map(
                    (item) => legacyConfig.dimensions?.[item.index]?.variableId
                ) ?? []
            )

            newConfig.dimensions = sortBy(newConfig.dimensions || [], (dim) =>
                variableIDsInSelectionOrder.findIndex(
                    (variableId) => dim.variableId === variableId
                )
            ).filter((dim) =>
                variableIDsInSelectionOrder.includes(dim.variableId)
            )
        }

        delete newConfig.selectedData

        return newConfig
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
                WHERE JSON_CONTAINS_PATH(${columnName}, 'one', '$.selectedData')
                `
            )
            for (const row of rows) {
                const config = JSON.parse(
                    row.json
                ) as GrapherInterfaceBeforeMigration
                const newConfig =
                    MigrateSelectedData1661264304751.transformConfig(config)
                await queryRunner.query(
                    `UPDATE ${tableName} SET ${columnName} = ? WHERE id = ?`,
                    [JSON.stringify(newConfig), row.id]
                )
            }
        }
    }

    public async down(): Promise<void> {
        // best of luck reverting this change :/
    }
}
