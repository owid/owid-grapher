import { CoreColumn, OwidTable } from "@ourworldindata/core-table"
import {
    ColumnSlug,
    EntityName,
    IndicatorTitleWithFragments,
    OwidVariableRow,
    SortOrder,
    Time,
} from "@ourworldindata/types"
import {
    EntityNamesByRegionType,
    EntityRegionType,
} from "../core/EntitiesByRegionType"
import { SelectionArray } from "../selection/SelectionArray"
import { TimelineDragTarget } from "../timeline/TimelineController"

// Grapher's rendered data table is organized into groups, where
// each group corresponds to an indicator from the core table.
// Each indicator group contains a set of columns, depending on
// the current time selection:
// - Single time selection: one column per indicator showing the value
// - Start and end time selection: two to four columns per indicator, including
//   start value, end value, and optionally absolute change and relative change
//   columns

export interface DataTableManager {
    table: OwidTable // not used here, but required in type `ChartManager`
    tableForDisplay: OwidTable
    entityType?: string
    endTime?: Time
    startTime?: Time
    dataTableSlugs?: ColumnSlug[]
    isNarrow?: boolean
    dataTableConfig: DataTableConfig
    dataTableSelection?: SelectionArray | EntityName[]
    entityNamesByRegionType?: EntityNamesByRegionType
    timelineDragTarget?: TimelineDragTarget
    closestTimelineMinTime?: Time
    closestTimelineMaxTime?: Time
}

/**
 * DataTableDimension represents an indicator from the core table that is
 * displayed in the data table as a group with one or more columns.
 *
 * A DataTableDimension contains:
 * - columnDefinitions: Defines which columns to display for this indicator
 *   (e.g., start/end columns, change columns)
 * - valuesByEntityName: The actual data for each column, grouped by entity
 * - coreTableColumn: Reference to the original indicator from the core table
 */
export interface DataTableDimension {
    columnDefinitions: DataTableColumnDefinition[]
    valuesByEntityName: Map<EntityName, DataTableValuesForEntity>
    coreTableColumn: CoreColumn
}

/**
 * DisplayDataTableDimension represents an indicator from the core table that is
 * displayed in the data table as a group with one or more columns. Unlike
 * DataTableDimension, it doesn't contain the actual data values but only the
 * metadata needed for display purposes.
 */
export interface DisplayDataTableDimension
    extends Omit<DataTableDimension, "valuesByEntityName"> {
    sortable: boolean
    display: { columnName: IndicatorTitleWithFragments; unit?: string }
}

/**
 * DataTableColumnDefinition defines the configuration for a single column
 * within a data table dimension. It specifies which type of data should be
 * displayed (e.g., start/end values or absolute/relative change).
 */
export interface DataTableColumnDefinition {
    key: DataTableColumnKey
    targetTime?: Time
    sortable: boolean
}

/**
 * DataTableRow represents a single row in the data table, corresponding to
 * one entity. It contains the entity name and an array of data table values,
 * where each element maps to a data table dimension.
 */
export interface DataTableRow {
    entityName: EntityName
    values: (DataTableValuesForEntity | undefined)[] // TODO make it not undefined
}

/**
 * TargetTimeMode determines how time selection affects the data table display.
 * - point: Single time selection, showing one value per indicator
 * - range: Time range selection, showing start/end values and absolute/relative change
 */
export enum TargetTimeMode {
    point = "point",
    range = "range",
}

export enum SparklineKey {
    sparkline = "sparkline",
}

/**
 * PointColumnKey defines the available column types when displaying single
 * time point data. Used when TargetTimeMode is set to 'point'.
 * - single: The data value for the selected time
 */
export enum PointColumnKey {
    single = "single",
}

/**
 * RangeColumnKey defines the available column types when displaying time
 * range data. Used when TargetTimeMode is set to 'range'.
 * - start: Value at the beginning of the time range
 * - end: Value at the end of the time range
 * - delta: Absolute change between start and end values
 * - deltaRatio: Relative change between start and end values
 */
export enum RangeColumnKey {
    start = "start",
    end = "end",
    delta = "delta",
    deltaRatio = "deltaRatio",
}

/**
 * PointValuesForEntity holds data for a single entity within a data table dimension
 * when TargetTimeMode is set to 'point' (single time selection).
 */
export type PointValuesForEntity = Partial<
    Record<PointColumnKey, MinimalOwidRow> &
        Record<SparklineKey, OwidVariableRow<number>[]>
>

/**
 * RangeValuesForEntity holds data for a single entity within a data table dimension
 * when TargetTimeMode is set to 'range' (time range selection). This includes
 * start and end values and absolute and relative change columns.
 */
export type RangeValuesForEntity = Partial<
    Record<RangeColumnKey, MinimalOwidRow> &
        Record<SparklineKey, OwidVariableRow<number>[]>
>

export type DataTableValuesForEntity =
    | PointValuesForEntity
    | RangeValuesForEntity

export type DataTableColumnKey = PointColumnKey | RangeColumnKey | SparklineKey

export interface MinimalOwidRow {
    value?: string | number
    displayValue?: string
    time?: Time
}

export const COMMON_DATA_TABLE_FILTERS = ["all", "selection"] as const
export type CommonDataTableFilter = (typeof COMMON_DATA_TABLE_FILTERS)[number]

export type DataTableFilter = CommonDataTableFilter | EntityRegionType

export interface DataTableConfig {
    filter: DataTableFilter
    search: string
}

export interface DataTableState {
    sort: DataTableSortState
}

export interface DataTableSortState {
    dimIndex: DimensionSortIndex
    columnKey: DataTableColumnKey | undefined
    order: SortOrder
}

export type DimensionSortIndex = number

export interface SparklineHighlight {
    time: Time
    value?: number
    showMarker?: boolean
}
