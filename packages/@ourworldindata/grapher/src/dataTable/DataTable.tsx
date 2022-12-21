import React from "react"
import { computed, observable, action } from "mobx"
import { observer } from "mobx-react"
import classnames from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faInfoCircle } from "@fortawesome/free-solid-svg-icons/faInfoCircle"
import {
    SortOrder,
    Time,
    EntityName,
    OwidTableSlugs,
    BlankOwidTable,
    OwidTable,
    CoreColumn,
} from "@ourworldindata/core-table"
import {
    capitalize,
    orderBy,
    upperFirst,
    valuesByEntityAtTimes,
    es6mapValues,
    valuesByEntityWithinTimes,
    getStartEndValues,
    sortBy,
    countBy,
    union,
    exposeInstanceOnWindow,
    DataValue,
    Bounds,
    DEFAULT_BOUNDS,
    ColumnSlug,
    TickFormattingOptions,
} from "@ourworldindata/utils"
import { SortIcon } from "../controls/SortIcon"
import { Tippy } from "../chart/Tippy"
import { makeSelectionArray } from "../chart/ChartUtils"
import { SelectionArray } from "../selection/SelectionArray"

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

const inverseSortOrder = (order: SortOrder): SortOrder =>
    order === SortOrder.asc ? SortOrder.desc : SortOrder.asc

export interface DataTableManager {
    table: OwidTable
    entityType: string
    endTime?: Time
    startTime?: Time
    dataTableSlugs?: ColumnSlug[]
}

@observer
export class DataTable extends React.Component<{
    manager?: DataTableManager
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
        dimIndex = Math.min(dimIndex, this.table.numColumns - 1)
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

    @computed get table(): OwidTable {
        return this.inputTable
    }

    @computed get inputTable(): OwidTable {
        return this.manager.table
    }

    @computed get manager(): DataTableManager {
        return (
            this.props.manager ?? {
                table: BlankOwidTable(),
                entityType: "country",
            }
        )
    }

    @computed private get entityType(): string {
        return this.manager.entityType
    }

    @computed private get sortValueMapper(): (
        row: DataTableRow
    ) => number | string {
        const { dimIndex, columnKey, order } = this.tableState.sort
        if (dimIndex === ENTITY_DIM_INDEX)
            return (row): string => row.entityName

        return (row): string | number => {
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

    @computed private get hasSubheaders(): boolean {
        return this.displayDimensions.some(
            (header) => header.columns.length > 1
        )
    }

    @action.bound private updateSort(
        dimIndex: DimensionIndex,
        columnKey?: ColumnKey
    ): void {
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

    private get entityHeader(): JSX.Element {
        const { sort } = this.tableState
        return (
            <ColumnHeader
                key="entity"
                sortable={true}
                sortedCol={sort.dimIndex === ENTITY_DIM_INDEX}
                sortOrder={sort.order}
                onClick={(): void => this.updateSort(ENTITY_DIM_INDEX)}
                rowSpan={this.hasSubheaders ? 2 : 1}
                headerText={capitalize(this.entityType)}
                colType="entity"
                dataType="text"
            />
        )
    }

    private get dimensionHeaders(): JSX.Element[] {
        const { sort } = this.tableState
        return this.displayDimensions.map((dim, dimIndex) => {
            const actualColumn = dim.coreTableColumn
            const unit =
                actualColumn.unit === "%" ? "percent" : dim.coreTableColumn.unit
            const targetTime =
                dim.columns.length == 1 ? dim.columns[0].targetTime : undefined
            const columnName =
                actualColumn.displayName !== ""
                    ? actualColumn.displayName
                    : actualColumn.name

            const dimensionHeaderText = (
                <React.Fragment>
                    <div className="name">{upperFirst(columnName)}</div>
                    <div>
                        <span className="unit">{unit}</span>{" "}
                        <span className="divider">
                            {unit && targetTime !== undefined && "•"}
                        </span>{" "}
                        <span className="time">
                            {targetTime !== undefined &&
                                actualColumn.formatTime(targetTime)}
                        </span>
                    </div>
                </React.Fragment>
            )

            const props = {
                sortable: dim.sortable,
                sortedCol: dim.sortable && sort.dimIndex === dimIndex,
                sortOrder: sort.order,
                onClick: (): void => {
                    if (dim.sortable) {
                        this.updateSort(dimIndex, SingleValueKey.single)
                    }
                },
                rowSpan: this.hasSubheaders && dim.columns.length < 2 ? 2 : 1,
                colSpan: dim.columns.length,
                headerText: dimensionHeaderText,
                colType: "dimension" as const,
                dataType: "numeric" as const,
            }

            return <ColumnHeader key={actualColumn.slug} {...props} />
        })
    }

    private get dimensionSubheaders(): JSX.Element[][] {
        const { sort } = this.tableState
        return this.displayDimensions.map((dim, dimIndex) =>
            dim.columns.map((column, i) => {
                const headerText = isDeltaColumn(column.key)
                    ? columnNameByType[column.key]
                    : dim.coreTableColumn.formatTime(column.targetTime!)
                return (
                    <ColumnHeader
                        key={column.key}
                        sortable={column.sortable}
                        sortedCol={
                            sort.dimIndex === dimIndex &&
                            sort.columnKey === column.key
                        }
                        sortOrder={sort.order}
                        onClick={(): void =>
                            this.updateSort(dimIndex, column.key)
                        }
                        headerText={headerText}
                        colType="subdimension"
                        dataType="numeric"
                        subdimensionType={column.key}
                        lastSubdimension={i === dim.columns.length - 1}
                    />
                )
            })
        )
    }

    private get headerRow(): JSX.Element {
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
        actualColumn: CoreColumn
    ): JSX.Element {
        if (dv === undefined || !(column.key in dv))
            return <td key={key} className="dimension" />

        let value: Value | undefined

        if (isSingleValue(dv)) value = dv[column.key as SingleValueKey] as Value
        else if (isRangeValue(dv))
            value = dv[column.key as RangeValueKey] as Value

        if (value === undefined) return <td key={key} className="dimension" />

        const shouldShowClosestTimeNotice =
            value.time !== undefined &&
            !isDeltaColumn(column.key) &&
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
                        actualColumn.formatTime(column.targetTime!),
                        actualColumn.formatTime(value.time!) // todo: add back format: "MMM D",
                    )}
                <span>{value.displayValue}</span>
            </td>
        )
    }

    private renderEntityRow(
        row: DataTableRow,
        dimensions: DataTableDimension[]
    ): JSX.Element {
        const { sort } = this.tableState
        return (
            <tr key={row.entityName}>
                <td
                    key="entity"
                    className={classnames({
                        entity: true,
                        sorted: sort.dimIndex === ENTITY_DIM_INDEX,
                    })}
                >
                    {row.entityName}
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
                            dimension.coreTableColumn
                        )
                    })
                })}
            </tr>
        )
    }

    private get valueRows(): JSX.Element[] {
        return this.sortedRows.map((row) =>
            this.renderEntityRow(row, this.displayDimensions)
        )
    }

    @computed get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    render(): JSX.Element {
        return (
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
        )
    }

    @computed private get loadedWithData(): boolean {
        return this.columnsToShow.length > 0
    }

    private readonly AUTO_SELECTION_THRESHOLD_PERCENTAGE = 0.5

    /**
     * If the user or the editor hasn't specified a start, auto-select a start time
     *  where AUTO_SELECTION_THRESHOLD_PERCENTAGE of the entities have values.
     */
    @computed get autoSelectedStartTime(): number | undefined {
        let autoSelectedStartTime: number | undefined = undefined

        if (
            // this.grapher.userHasSetTimeline ||
            //this.initialTimelineStartTimeSpecified ||
            !this.loadedWithData
        )
            return undefined

        const numEntitiesInTable = this.entityNames.length

        this.columnsToShow.forEach((column): boolean => {
            const numberOfEntitiesWithDataSortedByTime = sortBy(
                Object.entries(countBy(column.uniqTimesAsc)),
                (value) => parseInt(value[0])
            )

            const firstTimeWithSufficientData =
                numberOfEntitiesWithDataSortedByTime.find((time) => {
                    const numEntitiesWithData = time[1]
                    const percentEntitiesWithData =
                        numEntitiesWithData / numEntitiesInTable
                    return (
                        percentEntitiesWithData >=
                        this.AUTO_SELECTION_THRESHOLD_PERCENTAGE
                    )
                })?.[0]

            if (firstTimeWithSufficientData) {
                autoSelectedStartTime = parseInt(firstTimeWithSufficientData)
                return false
            }
            return true
        })

        return autoSelectedStartTime
    }

    @computed private get columnsToShow(): CoreColumn[] {
        const slugs = this.manager.dataTableSlugs ?? []
        if (slugs.length)
            return slugs
                .map((slug: string) => {
                    const col = this.table.get(slug)
                    if (!col)
                        console.warn(`Warning: column '${slug}' not found`)
                    return col
                })
                .filter((col) => col)

        const skips = new Set(Object.keys(OwidTableSlugs))
        return this.table.columnsAsArray.filter(
            (column) =>
                !skips.has(column.slug) &&
                !column.slug.endsWith("-originalTime") &&
                //  dim.property !== "color" &&
                (column.display?.includeInTable ?? true)
        )
    }

    @computed private get selectionArray(): SelectionArray {
        return makeSelectionArray(this.manager)
    }

    @computed private get entityNames(): string[] {
        const tableForEntities = this.table
        return union(
            ...this.columnsToShow.map(
                (col) => tableForEntities.get(col.slug).uniqEntityNames
            )
        )
    }

    componentDidMount(): void {
        exposeInstanceOnWindow(this, "dataTable")
    }

    formatValue(
        column: CoreColumn,
        value: number | string | undefined,
        formattingOverrides?: TickFormattingOptions
    ): string | undefined {
        return value === undefined
            ? value
            : column.formatValueShort(value, {
                  numberAbbreviation: false,
                  trailingZeroes: true,
                  ...formattingOverrides,
              })
    }

    @computed get targetTimes(): number[] | undefined {
        const { startTime, endTime } = this.manager
        if (startTime === undefined || endTime === undefined) return undefined

        if (startTime !== endTime) return [startTime, endTime]
        return [endTime]
    }

    @computed get columnsWithValues(): Dimension[] {
        return this.columnsToShow.map((sourceColumn) => {
            let targetTimes: number[]
            if (sourceColumn.def.targetTime !== undefined)
                targetTimes = [sourceColumn.def.targetTime]
            else if (this.targetTimes !== undefined)
                targetTimes = this.targetTimes
            else targetTimes = [sourceColumn.maxTime]

            const targetTimeMode =
                targetTimes.length < 2
                    ? TargetTimeMode.point
                    : TargetTimeMode.range

            const prelimValuesByEntity = this.preliminaryDimensionValues(
                targetTimeMode,
                sourceColumn,
                targetTimes
            )

            const valueByEntity = this.dataValuesFromPreliminaryValues(
                prelimValuesByEntity,
                targetTimeMode,
                sourceColumn
            )

            const columns: DimensionColumn[] = this.dimensionColumns(
                targetTimes,
                targetTimeMode
            )

            return {
                columns,
                valueByEntity,
                sourceColumn,
            }
        })
    }

    private dimensionColumns(
        targetTimes: number[],
        targetTimeMode: TargetTimeMode
    ): DimensionColumn[] {
        // Inject delta columns if we have start & end values to compare in the table.
        // One column for absolute difference, another for % difference.
        const deltaColumns: DimensionColumn[] = []
        if (targetTimeMode === TargetTimeMode.range) {
            const tableDisplay = {} as any
            if (!tableDisplay?.hideAbsoluteChange)
                deltaColumns.push({ key: RangeValueKey.delta })
            if (!tableDisplay?.hideRelativeChange)
                deltaColumns.push({ key: RangeValueKey.deltaRatio })
        }

        const valueColumns = targetTimes.map((targetTime, index) => ({
            key:
                targetTimeMode === TargetTimeMode.range
                    ? index === 0
                        ? RangeValueKey.start
                        : RangeValueKey.end
                    : SingleValueKey.single,
            targetTime,
            targetTimeMode,
        }))
        return [...valueColumns, ...deltaColumns]
    }

    private preliminaryDimensionValues(
        targetTimeMode: TargetTimeMode,
        sourceColumn: CoreColumn,
        targetTimes: number[]
    ): Map<string, (DataValue | undefined)[]> {
        return targetTimeMode === TargetTimeMode.range
            ? // In the "range" mode, we receive all data values within the range. But we

              // only want to plot the start & end values in the table.
              // getStartEndValues() extracts these two values.
              es6mapValues(
                  valuesByEntityWithinTimes(
                      sourceColumn.valueByEntityNameAndOriginalTime,
                      targetTimes
                  ),
                  getStartEndValues
              )
            : valuesByEntityAtTimes(
                  sourceColumn.valueByEntityNameAndOriginalTime,
                  targetTimes,
                  sourceColumn.tolerance
              )
    }

    private dataValuesFromPreliminaryValues(
        prelimValuesByEntity: Map<string, (DataValue | undefined)[]>,
        targetTimeMode: TargetTimeMode,
        sourceColumn: CoreColumn
    ): Map<string, DimensionValue> {
        return es6mapValues(prelimValuesByEntity, (dvs) => {
            // There is always a column, but not always a data value (in the delta column the
            // value needs to be calculated)
            if (targetTimeMode === TargetTimeMode.range) {
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
                    const deltaRatioValue = deltaValue / Math.abs(start.value)

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
                            isFinite(deltaRatioValue) && !isNaN(deltaRatioValue)
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
    }

    @computed get displayDimensions(): DataTableDimension[] {
        // Todo: for sorting etc, use CoreTable?
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
            coreTableColumn: d.sourceColumn,
        }))
    }

    @computed private get sortedRows(): DataTableRow[] {
        const { order } = this.tableState.sort
        return orderBy(this.displayRows, this.sortValueMapper, [order])
    }

    @computed private get displayRows(): DataTableRow[] {
        return this.entityNames.map((entityName) => {
            return {
                entityName,
                dimensionValues: this.columnsWithValues.map((d) =>
                    d.valueByEntity.get(entityName)
                ),
            }
        })
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
    subdimensionType?: ColumnKey
    lastSubdimension?: boolean
}): JSX.Element {
    const { sortable, sortedCol, colType, subdimensionType, lastSubdimension } =
        props
    return (
        <th
            className={classnames(colType, {
                sortable,
                sorted: sortedCol,
                firstSubdimension: subdimensionType === "start",
                endSubdimension: subdimensionType === "end",
                lastSubdimension,
            })}
            rowSpan={props.rowSpan ?? 1}
            colSpan={props.colSpan ?? 1}
            onClick={props.onClick}
        >
            <div
                className={classnames({
                    deltaColumn: isDeltaColumn(subdimensionType),
                })}
            >
                <span>{props.headerText}</span>
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
            </div>
        </th>
    )
}

const makeClosestTimeNotice = (
    targetTime: string,
    closestTime: string
): JSX.Element => (
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
    sourceColumn: CoreColumn
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
    coreTableColumn: CoreColumn
    sortable: boolean
}

interface DataTableRow {
    entityName: EntityName
    dimensionValues: (DimensionValue | undefined)[] // TODO make it not undefined
}

function isDeltaColumn(columnKey?: ColumnKey): boolean {
    return columnKey === "delta" || columnKey === "deltaRatio"
}
