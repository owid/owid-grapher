import { OwidTable } from "@ourworldindata/core-table"
import {
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
 * and the chart's wins.
 *
 * Charts built from OWID indicators get this for free, because the table is
 * assembled from those indicators and `legacyToOwidTableAndDimensions` folds
 * the dimension's display in as it goes. A chart built on a table the host
 * already has needs it done explicitly, which is what this is for.
 *
 * Returns the table unchanged when no slot overrides anything, so it costs
 * nothing on the common path.
 */
export const applyDimensionDisplayOverrides = (
    table: OwidTable,
    dimensions: OwidChartDimensionInterface[] | undefined
): OwidTable => {
    const displayBySlug = new Map<string, OwidVariableDisplayConfigInterface>()
    for (const dimension of dimensions ?? []) {
        const { slug, display } = dimension
        if (slug === undefined || display === undefined) continue
        if (Object.keys(display).length === 0) continue
        if (!table.has(slug)) continue
        displayBySlug.set(slug, { ...displayBySlug.get(slug), ...display })
    }
    if (displayBySlug.size === 0) return table

    return table.updateDefs((def: OwidColumnDef) => {
        const display = displayBySlug.get(def.slug)
        if (!display) return def
        return { ...def, display: { ...def.display, ...display } }
    })
}
