import { ColumnSlug } from "../../../clientUtils/owidTypes.js"
import { CoreColumnDef } from "../../../coreTable/CoreColumnDef.js"
import { SortOrder } from "../../../coreTable/CoreTableConstants.js"
import { OwidTable } from "../../../coreTable/OwidTable.js"
import { GrapherAnalytics } from "../../core/GrapherAnalytics.js"
import { SelectionArray } from "../../selection/SelectionArray.js"

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
