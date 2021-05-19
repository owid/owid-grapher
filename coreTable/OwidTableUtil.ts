import { ColumnTypeNames, CoreColumnDef } from "./CoreColumnDef"
import { CoreTable } from "./CoreTable"
import { ColumnTypeMap } from "./CoreTableColumns"
import { ColumnSlug } from "./CoreTableConstants"
import { OwidTable } from "./OwidTable"
import { OwidColumnDef, OwidTableSlugs } from "./OwidTableConstants"

export function timeColumnSlugOfValueColumn(
    table: OwidTable,
    valueColumnSlug: ColumnSlug
): ColumnSlug {
    const def = table.get(valueColumnSlug).def as OwidColumnDef
    if (def.isDailyMeasurement) {
        return table.timeColumn instanceof ColumnTypeMap.Day
            ? table.timeColumn.slug
            : OwidTableSlugs.day
    }
    return table.timeColumn instanceof ColumnTypeMap.Year
        ? table.timeColumn.slug
        : OwidTableSlugs.year
}

export function makeOriginalTimeSlugFromColumnSlug(slug: ColumnSlug): string {
    return `${slug}-originalTime`
}

export function getOriginalTimeColumnSlug(
    table: CoreTable,
    slug: ColumnSlug
): ColumnSlug {
    const originalTimeSlug = makeOriginalTimeSlugFromColumnSlug(slug)
    if (table.has(originalTimeSlug)) return originalTimeSlug
    return table.timeColumn.slug
}

export function toPercentageColumnDef(
    columnDef: CoreColumnDef,
    type = ColumnTypeNames.Percentage
): CoreColumnDef {
    // drops all values that can hinder the correct display of a percentage column
    // (e.g. a "kWh" unit or a numDecimalPlaces value of 0)
    return {
        ...columnDef,
        type,
        unit: undefined,
        shortUnit: undefined,
        display: {
            ...columnDef.display,
            unit: undefined,
            shortUnit: undefined,
            numDecimalPlaces: undefined,
            conversionFactor: undefined,
        },
    }
}
