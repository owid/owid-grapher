import * as _ from "lodash-es"
import {
    ColumnTypeNames,
    CoreValueType,
    EntityName,
    ErrorValue,
    OwidTableSlugs,
    SelectedEntityColors,
} from "@ourworldindata/types"
import { ErrorValueTypes, OwidTable } from "@ourworldindata/core-table"
import { FrameColumn } from "./FrameJoin.js"

/** Builds the entityColor column for a given list of entity names */
export const makeEntityColorColumn = (
    entityNames: readonly CoreValueType[],
    selectedEntityColors: SelectedEntityColors | undefined
): FrameColumn => ({
    def: {
        slug: OwidTableSlugs.EntityColor,
        name: OwidTableSlugs.EntityColor,
        type: ColumnTypeNames.Color,
    },
    values: entityNames.map(
        (entityName): string | ErrorValue =>
            (entityName
                ? selectedEntityColors?.[entityName as EntityName]
                : undefined) ?? ErrorValueTypes.UndefinedButShouldBeString
    ),
})

/** Adds the entity color column that applies a config's `selectedEntityColors` */
export const appendSelectedEntityColors = (
    table: OwidTable,
    selectedEntityColors: SelectedEntityColors | undefined
): OwidTable => {
    if (_.isEmpty(selectedEntityColors)) return table
    const { def, values } = makeEntityColorColumn(
        table.entityNameColumn.valuesIncludingErrorValues,
        selectedEntityColors
    )
    return table.appendColumns([{ ...def, values }])
}
