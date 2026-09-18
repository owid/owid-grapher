import * as _ from "lodash-es"
import { OwidTable } from "@ourworldindata/core-table"
import {
    ColumnTypeNames,
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
 * Two of those fields are not just recorded but acted on, exactly as
 * `legacyToOwidTableAndDimensions` acts on them while assembling an
 * indicator-backed table: `conversionFactor` scales the column's values (and
 * turns an integer column numeric when the factor isn't whole), and `color`
 * is copied onto the def itself, which is where the charts that colour a whole
 * series by column (discrete bar, Marimekko, dumbbell) read it from.
 *
 * Charts built from OWID indicators get all of this for free, because the
 * table is assembled from those indicators. A chart built on a table the host
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

    let result = table.updateDefs((def: OwidColumnDef) => {
        const display = displayBySlug.get(def.slug)
        if (!display) return def

        const updated: OwidColumnDef = {
            ...def,
            display: { ...def.display, ...display },
        }
        if (display.color !== undefined) updated.color = display.color
        // A non-integer factor applied to an integer column leaves it numeric.
        if (
            updated.type === ColumnTypeNames.Integer &&
            display.conversionFactor !== undefined &&
            !_.isInteger(display.conversionFactor)
        )
            updated.type = ColumnTypeNames.Numeric
        return updated
    })

    for (const [slug, display] of displayBySlug) {
        const { conversionFactor } = display
        if (conversionFactor === undefined || conversionFactor === 1) continue
        result = result.replaceCells([slug], (value) =>
            _.isNumber(value) ? value * conversionFactor : value
        )
    }

    return result
}
