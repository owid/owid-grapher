import * as _ from "lodash-es"
import { OwidTable } from "@ourworldindata/core-table"
import { trimObject } from "@ourworldindata/utils"
import {
    ColumnTypeNames,
    TransformType,
    isIndicatorDimension,
    type ColumnSlug,
    type OwidChartDimensionInterface,
    type OwidColumnDef,
    type OwidVariableDisplayConfigInterface,
} from "@ourworldindata/types"

export interface ColumnDisplayOverride {
    columnSlug: ColumnSlug
    display: OwidVariableDisplayConfigInterface | undefined
}

/**
 * Lay each slot's `display` over the definition of the column it points at.
 *
 * Only slots naming a column of the host's own table are applied. Indicator
 * slots get their display from the OWID pipeline when it builds the table.
 *
 * Two `display` fields are not just recorded but acted on. `conversionFactor`
 * scales the column's values (and turns an integer column numeric when the
 * factor isn't whole), and `color` is copied onto the def itself. Because of
 * the scaling, a table's values must go through this exactly once.
 *
 * Returns the table unchanged when no slot overrides anything.
 */
export const applyDimensionDisplayOverrides = (
    table: OwidTable,
    dimensions: OwidChartDimensionInterface[] | undefined
): OwidTable =>
    applyColumnDisplayOverrides(
        table,
        (dimensions ?? []).flatMap((dimension) =>
            !isIndicatorDimension(dimension) && dimension.slug !== undefined
                ? [{ columnSlug: dimension.slug, display: dimension.display }]
                : []
        )
    )

export const applyColumnDisplayOverrides = (
    table: OwidTable,
    overrides: ColumnDisplayOverride[]
): OwidTable => {
    const displayBySlug = new Map<
        ColumnSlug,
        OwidVariableDisplayConfigInterface
    >()
    for (const { columnSlug, display } of _.uniqBy(
        overrides,
        (override) => override.columnSlug
    )) {
        if (!table.has(columnSlug)) continue
        const definedDisplay = trimObject(display ?? {})
        if (Object.keys(definedDisplay).length > 0)
            displayBySlug.set(columnSlug, definedDisplay)
    }
    if (displayBySlug.size === 0) return table

    const columnStore = { ...table.columnStore }
    const defs = table.defs.map((def) => {
        const display = displayBySlug.get(def.slug)
        if (!display) return def

        const updated: OwidColumnDef = {
            ...def,
            display: { ...def.display, ...display },
        }
        if (display.color) updated.color = display.color

        const { conversionFactor } = display
        if (conversionFactor !== undefined && conversionFactor !== 1)
            columnStore[def.slug] = columnStore[def.slug].map((value) =>
                _.isNumber(value) ? value * conversionFactor : value
            )
        if (
            updated.type === ColumnTypeNames.Integer &&
            conversionFactor !== undefined &&
            !_.isInteger(conversionFactor)
        )
            updated.type = ColumnTypeNames.Numeric
        return updated
    })

    return new OwidTable(columnStore, defs, {
        parent: table,
        tableDescription: "Applied slot display",
        transformCategory: TransformType.UpdateColumnDefs,
    })
}
