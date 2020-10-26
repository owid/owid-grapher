import { Color, ColumnSlug, SortOrder } from "coreTable/CoreTableConstants"
import { OwidTable } from "coreTable/OwidTable"
import { Analytics } from "grapher/core/Analytics"

export interface CountryPickerManager {
    countryPickerMetric?: ColumnSlug
    countryPickerSort?: SortOrder
    requiredColumnSlugs?: ColumnSlug[] // If this param is provided, and an entity does not have a value for 1+, it will show as unavailable.
    pickerColumnSlugs?: ColumnSlug[] // These are the columns that can be used for sorting entities.
    analytics?: Analytics
    countryPickerTable: OwidTable
    entityColorMap?: {
        [entityName: string]: Color | undefined
    }
    analyticsNamespace?: string
}
