import { ColumnSlug } from "../../../clientUtils/owidTypes"
import { CoreColumnDef } from "../../../coreTable/CoreColumnDef"
import { SortOrder } from "../../../coreTable/CoreTableConstants"
import { OwidTable } from "../../../coreTable/OwidTable"
import { GrapherAnalytics } from "../../core/GrapherAnalytics"
import { SelectionArray } from "../../selection/SelectionArray"

export interface EntityPickerManager {
    entityPickerMetric?: ColumnSlug
    entityPickerSort?: SortOrder
    setEntityPicker?: (options: { metric?: string; sort?: SortOrder }) => void
    requiredColumnSlugs?: ColumnSlug[] // If this param is provided, and an entity does not have a value for 1+, it will show as unavailable.
    entityPickerColumnDefs?: CoreColumnDef[]
    entityPickerTable?: OwidTable
    entityPickerTableIsLoading?: boolean
    grapherTable?: OwidTable
    selection: SelectionArray
    analytics?: GrapherAnalytics
    analyticsNamespace?: string
}
