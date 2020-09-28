import * as React from "react"
import { computed, observable, action } from "mobx"
import { observer } from "mobx-react"
import classnames from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faInfoCircle } from "@fortawesome/free-solid-svg-icons/faInfoCircle"
import {
    SortOrder,
    TickFormattingOptions,
    Time,
} from "grapher/core/GrapherConstants"
import {
    capitalize,
    orderBy,
    upperFirst,
    valuesByEntityAtTimes,
    es6mapValues,
    valuesByEntityWithinTimes,
    getStartEndValues,
    intersection,
    flatten,
    sortBy,
    countBy,
    union,
} from "grapher/utils/Util"
import { SortIcon } from "grapher/controls/SortIcon"
import { Tippy } from "grapher/chart/Tippy"
import { OwidTable } from "coreTable/OwidTable"
import { AbstractCoreColumn } from "coreTable/CoreTable"
import { Bounds, DEFAULT_BOUNDS } from "grapher/utils/Bounds"

interface DataTableState {
    sort: DataTableSortState
}

const ENTITY_DIM_INDEX = -1

type DimensionIndex = number

interface DataTableSortState {
    dimIndex: DimensionIndex
    columnKey: ColumnKey | undefined
    order: SortOrder
}

const DEFAULT_SORT_STATE: DataTableSortState = {
    dimIndex: ENTITY_DIM_INDEX,
    columnKey: undefined,
    order: SortOrder.asc,
}

const columnNameByType: Record<ColumnKey, string> = {
    single: "Value",
    start: "Start",
    end: "End",
    delta: "Absolute Change",
    deltaRatio: "Relative Change",
}

function inverseSortOrder(order: SortOrder): SortOrder {
    return order === SortOrder.asc ? SortOrder.desc : SortOrder.asc
}

interface DataTableManager {
    table: OwidTable
}

@observer
export class DataTable extends React.Component<{
    manager: DataTableManager
    bounds?: Bounds
}> {
    @observable private storedState: DataTableState = {
        sort: DEFAULT_SORT_STATE,
    }

    @computed private get tableState(): DataTableState {
        return {
            sort: this.sortState,
        }
    }

    @computed private get sortState(): DataTableSortState {
        let { dimIndex, columnKey, order } = {
            ...DEFAULT_SORT_STATE,
            ...this.storedState.sort,
        }

        // If not sorted by entity, then make sure the index of the chosen column exists
        dimIndex = Math.min(dimIndex, this.table.columnsAsArray.length - 1)
        if (dimIndex !== ENTITY_DIM_INDEX) {
            const availableColumns = this.columnsWithValues[
                dimIndex
            ].columns.map((sub) => sub.key)
            if (
                columnKey === undefined ||
                !availableColumns.includes(columnKey)
            )
                columnKey = availableColumns[0]
        }

        return {
            dimIndex,
            columnKey,
            order,
        }
    }

    @computed get table() {
        return this.manager.table
    }

    @computed get manager() {
        return this.props.manager
    }

    @computed private get entityType() {
        return this.table.entityType
    }

    @computed private get sortValueMapper(): (
        row: DataTableRow
    ) => number | string | undefined {
        const { dimIndex, columnKey, order } = this.tableState.sort
        if (dimIndex === ENTITY_DIM_INDEX) return (row) => row.entity

        return (row) => {
            const dv = row.dimensionValues[dimIndex] as DimensionValue

            let value: number | string | undefined
            if (dv) {
                if (isSingleValue(dv)) value = dv.single?.value
                else if (
                    isRangeValue(dv) &&
                    columnKey !== undefined &&
                    columnKey in RangeValueKey
                )
                    value = dv[columnKey as RangeValueKey]?.value
            }

            // We always want undefined values to be last
            if (
                value === undefined ||
                (typeof value === "number" &&
                    (!isFinite(value) || isNaN(value)))
            )
                return order === SortOrder.asc ? Infinity : -Infinity

            return value
        }
    }

    @computed private get displayRowsSorted() {
        const { order } = this.tableState.sort
        return orderBy(this.displayRows, this.sortValueMapper, [order])
    }

    @computed private get hasSubheaders() {
        return this.displayDimensions.some(
            (header) => header.columns.length > 1
        )
    }

    @action.bound private updateSort(
        dimIndex: DimensionIndex,
        columnKey?: ColumnKey
    ) {
        const { sort } = this.tableState
        const order =
            sort.dimIndex === dimIndex && sort.columnKey === columnKey
                ? inverseSortOrder(sort.order)
                : dimIndex === ENTITY_DIM_INDEX
                ? SortOrder.asc
                : SortOrder.desc

        this.storedState.sort.dimIndex = dimIndex
        this.storedState.sort.columnKey = columnKey
        this.storedState.sort.order = order
    }

    private get entityHeader() {
        const { sort } = this.tableState
        return (
            <ColumnHeader
                key="entity"
                sortable={true}
                sortedCol={sort.dimIndex === ENTITY_DIM_INDEX}
                sortOrder={sort.order}
                onClick={() => this.updateSort(ENTITY_DIM_INDEX)}
                rowSpan={this.hasSubheaders ? 2 : 1}
                headerText={capitalize(this.entityType)}
                colType="entity"
                dataType="text"
            />
        )
    }

    private get dimensionHeaders() {
        const { sort } = this.tableState
        return this.displayDimensions.map((dim, dimIndex) => {
            const actualColumn = dim.coreColumn
            const unit =
                actualColumn.unit === "%" ? "percent" : dim.coreColumn.unit
            const dimensionHeaderText = (
                <React.Fragment>
                    <span className="name">
                        {upperFirst(actualColumn.displayName)}
                    </span>
                    <span className="unit">{unit}</span>
                </React.Fragment>
            )

            const props = {
                sortable: dim.sortable,
                sortedCol: dim.sortable && sort.dimIndex === dimIndex,
                sortOrder: sort.order,
                onClick: () =>
                    dim.sortable &&
                    this.updateSort(dimIndex, SingleValueKey.single),
                rowSpan: this.hasSubheaders && dim.columns.length < 2 ? 2 : 1,
                colSpan: dim.columns.length,
                headerText: dimensionHeaderText,
                colType: "dimension" as const,
                dataType: "numeric" as const,
            }

            return <ColumnHeader key={actualColumn.slug} {...props} />
        })
    }

    private get dimensionSubheaders() {
        const { sort } = this.tableState
        return this.displayDimensions.map((dim, dimIndex) =>
            dim.columns.map((column) => {
                const headerText =
                    column.targetTimeMode === TargetTimeMode.point
                        ? dim.coreColumn.table.formatTime(column.targetTime!)
                        : columnNameByType[column.key]
                return (
                    <ColumnHeader
                        key={column.key}
                        sortable={column.sortable}
                        sortedCol={
                            sort.dimIndex === dimIndex &&
                            sort.columnKey === column.key
                        }
                        sortOrder={sort.order}
                        onClick={() => this.updateSort(dimIndex, column.key)}
                        headerText={headerText}
                        colType="subdimension"
                        dataType="numeric"
                    />
                )
            })
        )
    }

    private get headerRow() {
        return (
            <React.Fragment>
                <tr>
                    {this.entityHeader}
                    {this.dimensionHeaders}
                </tr>
                {this.hasSubheaders && <tr>{this.dimensionSubheaders}</tr>}
            </React.Fragment>
        )
    }

    private renderValueCell(
        key: string,
        column: DataTableColumn,
        dv: DimensionValue | undefined,
        sorted: boolean,
        actualColumn: AbstractCoreColumn
    ) {
        if (dv === undefined || !(column.key in dv))
            return <td key={key} className="dimension" />

        let value: Value | undefined

        if (isSingleValue(dv)) value = dv[column.key as SingleValueKey] as Value
        else if (isRangeValue(dv))
            value = dv[column.key as RangeValueKey] as Value

        if (value === undefined) return <td key={key} className="dimension" />

        const shouldShowClosestTimeNotice =
            value.time !== undefined &&
            column.targetTimeMode === TargetTimeMode.point &&
            column.targetTime !== undefined &&
            column.targetTime !== value.time

        return (
            <td
                key={key}
                className={classnames([
                    "dimension",
                    `dimension-${column.key}`,
                    {
                        sorted,
                    },
                ])}
            >
                {shouldShowClosestTimeNotice &&
                    makeClosestTimeNotice(
                        actualColumn.table.formatTime(column.targetTime!),
                        actualColumn.table.formatTime(value.time!) // todo: add back format: "MMM D",
                    )}
                {value.displayValue}
                {value.time !== undefined &&
                    column.targetTimeMode === TargetTimeMode.range && (
                        <span className="range-time"> in {value.time}</span>
                    )}
            </td>
        )
    }

    private renderEntityRow(
        row: DataTableRow,
        dimensions: DataTableDimension[]
    ) {
        const { sort } = this.tableState
        return (
            <tr key={row.entity}>
                <td
                    key="entity"
                    className={classnames({
                        entity: true,
                        sorted: sort.dimIndex === ENTITY_DIM_INDEX,
                    })}
                >
                    {row.entity}
                </td>
                {row.dimensionValues.map((dv, dimIndex) => {
                    const dimension = dimensions[dimIndex]
                    return dimension.columns.map((column, colIndex) => {
                        const key = `${dimIndex}-${colIndex}`
                        return this.renderValueCell(
                            key,
                            column,
                            dv,
                            sort.dimIndex === dimIndex &&
                                sort.columnKey === column.key,
                            dimension.coreColumn
                        )
                    })
                })}
            </tr>
        )
    }

    private get valueRows() {
        return this.displayRows.map((row) =>
            this.renderEntityRow(row, this.displayDimensions)
        )
    }

    @computed get bounds() {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    render() {
        const { bounds } = this

        return (
            <div
                className="tableTab"
                style={{ ...bounds.toCSS(), position: "absolute" }}
            >
                <div
                    style={{
                        width: "100%",
                        height: "100%",
                        overflow: "auto",
                    }}
                >
                    <table className="data-table">
                        <thead>{this.headerRow}</thead>
                        <tbody>{this.valueRows}</tbody>
                    </table>
                </div>
            </div>
        )
    }

    @computed private get loadedWithData() {
        return this.columnsToShow.length > 0
    }

    private readonly AUTO_SELECTION_THRESHOLD_PERCENTAGE = 0.5

    /**
     * If the user or the editor hasn't specified a start, auto-select a start time
     *  where AUTO_SELECTION_THRESHOLD_PERCENTAGE of the entities have values.
     */
    @computed get autoSelectedStartTime() {
        let autoSelectedStartTime: number | undefined = undefined

        if (
            // this.grapher.userHasSetTimeline ||
            //this.initialTimelineStartTimeSpecified ||
            !this.loadedWithData
        )
            return undefined

        const numEntitiesInTable = this.entities.length

        this.columnsToShow.forEach((column) => {
            const numberOfEntitiesWithDataSortedByTime = sortBy(
                Object.entries(countBy(column.times)),
                (value) => parseInt(value[0])
            )

            const firstTimeWithSufficientData = numberOfEntitiesWithDataSortedByTime.find(
                (time) => {
                    const numEntitiesWithData = time[1]
                    const percentEntitiesWithData =
                        numEntitiesWithData / numEntitiesInTable
                    return (
                        percentEntitiesWithData >=
                        this.AUTO_SELECTION_THRESHOLD_PERCENTAGE
                    )
                }
            )?.[0]

            if (firstTimeWithSufficientData) {
                autoSelectedStartTime = parseInt(firstTimeWithSufficientData)
                return false
            }
            return true
        })

        return autoSelectedStartTime
    }

    @computed get availableTimes() {
        return intersection(
            flatten(this.columns.map((column) => column.timesUniq))
        )
    }

    @computed get columns() {
        return this.table.columnsAsArray
    }

    @computed get columnsToShow() {
        return this.columns.filter(
            (column) =>
                //  dim.property !== "color" &&
                column.display.includeInTable ?? true
        )
    }

    @computed get entities() {
        return union(
            ...this.columnsToShow.map((column) => column.entityNamesUniqArr)
        )
    }

    formatValue(
        column: AbstractCoreColumn,
        value: number | string | undefined,
        formattingOverrides?: TickFormattingOptions
    ) {
        return value === undefined
            ? value
            : column.formatValueShort(value, {
                  numberPrefixes: false,
                  noTrailingZeroes: false,
                  ...formattingOverrides,
              })
    }

    @computed get columnsWithValues(): Dimension[] {
        return this.columnsToShow.map((sourceColumn) => {
            const targetTimes = [sourceColumn.maxTime]

            const targetTimeMode =
                targetTimes.length < 2
                    ? TargetTimeMode.point
                    : TargetTimeMode.range

            const prelimValuesByEntity =
                targetTimeMode === TargetTimeMode.range
                    ? // In the "range" mode, we receive all data values within the range. But we
                      // only want to plot the start & end values in the table.
                      // getStartEndValues() extracts these two values.
                      es6mapValues(
                          valuesByEntityWithinTimes(
                              sourceColumn.valueByEntityNameAndTime,
                              targetTimes
                          ),
                          getStartEndValues
                      )
                    : valuesByEntityAtTimes(
                          sourceColumn.valueByEntityNameAndTime,
                          targetTimes,
                          sourceColumn.tolerance
                      )

            const isRange = targetTimes.length === 2

            // Inject delta columns if we have start & end values to compare in the table.
            // One column for absolute difference, another for % difference.
            const deltaColumns: DimensionColumn[] = []
            if (isRange) {
                const tableDisplay = {} as any
                if (!tableDisplay?.hideAbsoluteChange)
                    deltaColumns.push({ key: RangeValueKey.delta })
                if (!tableDisplay?.hideRelativeChange)
                    deltaColumns.push({ key: RangeValueKey.deltaRatio })
            }

            const columns: DimensionColumn[] = [
                ...targetTimes.map((targetTime, index) => ({
                    key: isRange
                        ? index === 0
                            ? RangeValueKey.start
                            : RangeValueKey.end
                        : SingleValueKey.single,
                    targetTime,
                    targetTimeMode,
                })),
                ...deltaColumns,
            ]

            const valueByEntity = es6mapValues(prelimValuesByEntity, (dvs) => {
                // There is always a column, but not always a data value (in the delta column the
                // value needs to be calculated)
                if (isRange) {
                    const [start, end]: (Value | undefined)[] = dvs
                    const result: RangeValue = {
                        start: {
                            ...start,
                            displayValue: this.formatValue(
                                sourceColumn,
                                start?.value
                            ),
                        },
                        end: {
                            ...end,
                            displayValue: this.formatValue(
                                sourceColumn,
                                end?.value
                            ),
                        },
                        delta: undefined,
                        deltaRatio: undefined,
                    }

                    if (
                        start !== undefined &&
                        end !== undefined &&
                        typeof start.value === "number" &&
                        typeof end.value === "number"
                    ) {
                        const deltaValue = end.value - start.value
                        const deltaRatioValue =
                            deltaValue / Math.abs(start.value)

                        result.delta = {
                            value: deltaValue,
                            displayValue: this.formatValue(
                                sourceColumn,
                                deltaValue,
                                {
                                    showPlus: true,
                                    unit:
                                        sourceColumn.shortUnit === "%"
                                            ? "pp"
                                            : sourceColumn.shortUnit,
                                }
                            ),
                        }

                        result.deltaRatio = {
                            value: deltaRatioValue,
                            displayValue:
                                isFinite(deltaRatioValue) &&
                                !isNaN(deltaRatioValue)
                                    ? this.formatValue(
                                          sourceColumn,
                                          deltaRatioValue * 100,
                                          {
                                              unit: "%",
                                              numDecimalPlaces: 0,
                                              showPlus: true,
                                          }
                                      )
                                    : undefined,
                        }
                    }
                    return result
                } else {
                    // if single time
                    const dv = dvs[0]
                    const result: SingleValue = {
                        single: { ...dv },
                    }
                    if (dv !== undefined)
                        result.single!.displayValue = this.formatValue(
                            sourceColumn,
                            dv.value
                        )
                    return result
                }
            })

            return {
                columns,
                valueByEntity,
                sourceColumn,
            }
        })
    }

    @computed get displayDimensions(): DataTableDimension[] {
        return this.columnsWithValues.map((d) => ({
            // A top-level header is only sortable if it has a single nested column, because
            // in that case the nested column is not rendered.
            sortable: d.columns.length === 1,
            columns: d.columns.map((column) => ({
                ...column,
                // All columns are sortable for now, but in the future we will have a sparkline that
                // is not sortable.
                sortable: true,
            })),
            coreColumn: d.sourceColumn,
        }))
    }

    @computed get displayRows(): DataTableRow[] {
        const rows = this.entities.map((entity) => {
            const dimensionValues = this.columnsWithValues.map((d) =>
                d.valueByEntity.get(entity)
            )
            return {
                entity,
                dimensionValues,
            }
        })
        return rows
    }
}

function ColumnHeader(props: {
    sortable: boolean
    sortedCol: boolean
    sortOrder: SortOrder
    onClick: () => void
    rowSpan?: number
    colSpan?: number
    headerText: React.ReactFragment
    colType: "entity" | "dimension" | "subdimension"
    dataType: "text" | "numeric"
}) {
    const { sortable, sortedCol, colType } = props
    return (
        <th
            className={classnames(colType, {
                sortable: sortable,
                sorted: sortedCol,
            })}
            rowSpan={props.rowSpan ?? 1}
            colSpan={props.colSpan ?? 1}
            onClick={props.onClick}
        >
            {props.headerText}
            {sortable && (
                <SortIcon
                    type={props.dataType}
                    isActiveIcon={sortedCol}
                    order={
                        sortedCol
                            ? props.sortOrder
                            : colType === "entity"
                            ? SortOrder.asc
                            : SortOrder.desc
                    }
                />
            )}
        </th>
    )
}

const makeClosestTimeNotice = (targetTime: string, closestTime: string) => (
    <Tippy
        content={
            <div className="closest-time-notice-tippy">
                <strong>Data not available for {targetTime}</strong>
                <br />
                Showing closest available data point ({closestTime})
            </div>
        }
        arrow={false}
    >
        <span className="closest-time-notice-icon">
            {closestTime}{" "}
            <span className="icon">
                <FontAwesomeIcon icon={faInfoCircle} />
            </span>
        </span>
    </Tippy>
)

enum TargetTimeMode {
    point = "point",
    range = "range",
}

interface Dimension {
    columns: DimensionColumn[]
    valueByEntity: Map<string, DimensionValue>
    sourceColumn: AbstractCoreColumn
}

interface DimensionColumn {
    key: SingleValueKey | RangeValueKey
    targetTime?: Time
    targetTimeMode?: TargetTimeMode
}

interface DataTableColumn extends DimensionColumn {
    sortable: boolean
}

interface Value {
    value?: string | number
    displayValue?: string
    time?: Time
}

// range (two point values)
enum RangeValueKey {
    start = "start",
    end = "end",
    delta = "delta",
    deltaRatio = "deltaRatio",
}

type RangeValue = Record<RangeValueKey, Value | undefined>

function isRangeValue(value: DimensionValue): value is RangeValue {
    return "start" in value
}

// single point values
enum SingleValueKey {
    single = "single",
}

type SingleValue = Record<SingleValueKey, Value | undefined>

function isSingleValue(value: DimensionValue): value is SingleValue {
    return "single" in value
}

// combined types
type DimensionValue = SingleValue | RangeValue
type ColumnKey = SingleValueKey | RangeValueKey

interface DataTableDimension {
    columns: DataTableColumn[]
    coreColumn: AbstractCoreColumn
    sortable: boolean
}

interface DataTableRow {
    entity: string
    dimensionValues: (DimensionValue | undefined)[] // TODO make it not undefined
}
