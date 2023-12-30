import { ColumnSlug } from "@ourworldindata/utils"
import { GrapherAnalytics } from "../../core/GrapherAnalytics"
import { OwidTable } from "@ourworldindata/core-table"
import { CoreColumnDef, SortOrder } from "@ourworldindata/types"
import { SelectionArray } from "../../selection/SelectionArray"

export interface EntityPickerManager {
    entityPickerMetric?: ColumnSlug
    entityPickerSort?: SortOrder
    setEntityPicker?: (options: {
        metric: string | undefined
        sort?: SortOrder
    }) => void
    requiredColumnSlugs?: ColumnSlug[] // If this param is provided, and an entity does not have a value for 1+, it will show as unavailable.
    entityPickerColumnDefs?: CoreColumnDef[]
    entityPickerTable?: OwidTable
    entityPickerTableIsLoading?: boolean
    grapherTable?: OwidTable
    selection: SelectionArray
    entityType?: string
    analytics?: GrapherAnalytics
}
