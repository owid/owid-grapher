import { ColumnSlug } from "./CoreTableConstants"
import { OwidColumnDef, OwidTableSlugs } from "./OwidTableConstants"

export function timeColumnSlugFromColumnDef(def: OwidColumnDef) {
    return def.isDailyMeasurement ? OwidTableSlugs.day : OwidTableSlugs.year
}

export function makeOriginalTimeSlugFromColumnSlug(slug: ColumnSlug) {
    return `${slug}-originalTime`
}
