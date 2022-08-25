import { MigrationInterface, QueryRunner } from "typeorm"
import { excludeUndefined, sortBy, uniq } from "../../clientUtils/Util.js"

import { entityNamesById } from "../../grapher/entityIdsToNames.js"

import {
    LegacyGrapherInterface,
    GrapherInterface,
} from "../../grapher/core/GrapherInterface.js"

export function transformConfig(
    legacyConfig: LegacyGrapherInterface | undefined
): GrapherInterface {
    if (!legacyConfig?.selectedData?.length) {
        if (legacyConfig) delete legacyConfig.selectedData
        return legacyConfig ?? {}
    }

    const newConfig = { ...legacyConfig } as LegacyGrapherInterface
    /*
    (x) select variables to show
    (x) select entities to show by default
    (x) specify the order of dimensions
    specify colors for dimensions
    */

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

    // Migrate order of dimensions.
    // Skipped for LineCharts, because there dimension order doesn't matter and changing them up will only affect colors.
    if (newConfig.type !== "LineChart" && newConfig.type !== undefined) {
        // TODO: Maybe do a flatMap instead of sortBy? And then have a look manually?
        newConfig.dimensions = sortBy(newConfig.dimensions || [], (dim) =>
            variableIDsInSelectionOrder.findIndex(
                (variableId) => dim.variableId === variableId
            )
        ).filter((dim) => variableIDsInSelectionOrder.includes(dim.variableId))
    }

    delete newConfig.selectedData

    return newConfig
}

export class MigrateSelectedData1661264304751 implements MigrationInterface {
    name = "MigrateSelectedData1661264304751"

    public async up(queryRunner: QueryRunner): Promise<void> {}

    public async down(queryRunner: QueryRunner): Promise<void> {}
}
