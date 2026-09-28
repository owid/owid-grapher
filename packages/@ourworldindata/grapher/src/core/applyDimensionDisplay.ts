import * as _ from "lodash-es"
import { OwidTable } from "@ourworldindata/core-table"
import { trimObject } from "@ourworldindata/utils"
import {
    ColumnTypeNames,
    TransformType,
    type ColumnSlug,
    type OwidChartDimensionInterface,
    type OwidColumnDef,
    type OwidVariableDisplayConfigInterface,
} from "@ourworldindata/types"

/**
 * Lay each slot's `display` over the definition of the column it points at.
 *
 * A column definition says what a column *is*, and belongs to whoever supplies
 * the data. A dimension's `display` says what *this chart* makes of it: call
 * it something else here, show two decimals here. The two are the same shape,
 * and the chart's wins. Where several slots name one column, the first one's
 * display is used.
 *
 * Two of those fields are not just recorded but acted on. `conversionFactor`
 * scales the column's values (and turns an integer column numeric when the
 * factor isn't whole), and `color` is copied onto the def itself. Because of
 * the scaling, a table's values must go through this exactly once.
 *
 * Returns the table unchanged when no slot overrides anything.
 */
export const applyDimensionDisplayOverrides = (
    table: OwidTable,
    dimensions: OwidChartDimensionInterface[] | undefined
): OwidTable => {
    const displayBySlug = new Map<
        ColumnSlug,
        OwidVariableDisplayConfigInterface
    >()
    for (const { slug, display } of _.uniqBy(
        dimensions ?? [],
        (dimension) => dimension.slug
    )) {
        if (slug === undefined || !table.has(slug)) continue
        const definedDisplay = trimObject(display ?? {})
        if (Object.keys(definedDisplay).length > 0)
            displayBySlug.set(slug, definedDisplay)
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
