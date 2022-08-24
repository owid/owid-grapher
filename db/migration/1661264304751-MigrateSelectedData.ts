import { MigrationInterface, QueryRunner } from "typeorm"
import { excludeUndefined, sortBy, uniq } from "../../clientUtils/Util.js"

import { entityNamesById } from "../../grapher/entityIdsToNames.js"

import {
    LegacyGrapherInterface,
    GrapherInterface,
} from "../../grapher/core/GrapherInterface.js"

export function transformConfig(
    legacyConfig: LegacyGrapherInterface
): GrapherInterface {
    if (!legacyConfig.selectedData) return legacyConfig

    const newConfig = { ...legacyConfig } as LegacyGrapherInterface
    /*
    (x) select variables to show
    (x) select entities to show by default
    (x) specify the order of dimensions
    specify colors for dimensions
    */

    newConfig.selectedEntityIds = uniq(
        legacyConfig.selectedData.map((row) => row.entityId)
    ) // We need to do uniq because an EntityName may appear multiple times in the old graphers, once for each dimension

    legacyConfig.selectedData
        .slice()
        .reverse()
        .forEach((item) => {
            if (item.entityId && item.color) {
                // migrate entity color
                if (!legacyConfig.selectedEntityColors) {
                    newConfig.selectedEntityColors =
                        newConfig.selectedEntityColors ?? {}
                    const entityName = entityNamesById[item.entityId]
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

    const variableIDsInSelectionOrder = excludeUndefined(
        legacyConfig.selectedData?.map(
            (item) => legacyConfig.dimensions?.[item.index]?.variableId
        ) ?? []
    )

    if (newConfig.type !== "LineChart" && newConfig.type !== undefined) {
        newConfig.dimensions = sortBy(newConfig.dimensions || [], (dim) =>
            variableIDsInSelectionOrder.findIndex(
                (variableId) => dim.variableId === variableId
            )
        )
    }

    delete newConfig.selectedData

    return newConfig
}

export class MigrateSelectedData1661264304751 implements MigrationInterface {
    name = "MigrateSelectedData1661264304751"

    public async up(queryRunner: QueryRunner): Promise<void> {}

    public async down(queryRunner: QueryRunner): Promise<void> {}
}
