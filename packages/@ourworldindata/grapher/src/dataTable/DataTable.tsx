import React from "react"
import { computed, observable, action } from "mobx"
import { observer } from "mobx-react"
import classnames from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import {
    faArrowDownLong,
    faArrowUpLong,
    faInfoCircle,
} from "@fortawesome/free-solid-svg-icons"
import {
    SortOrder,
    Time,
    EntityName,
    OwidTableSlugs,
} from "@ourworldindata/types"
import {
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
    sortBy,
    countBy,
    union,
    exposeInstanceOnWindow,
    DataValue,
    Bounds,
    DEFAULT_BOUNDS,
    ColumnSlug,
    TickFormattingOptions,
    Tippy,
    isCountryName,
    range,
    maxBy,
    minBy,
    excludeUndefined,
    IndicatorTitleWithFragments,
    joinTitleFragments,
} from "@ourworldindata/utils"
import { makeSelectionArray } from "../chart/ChartUtils"
import { SelectionArray } from "../selection/SelectionArray"
import { DEFAULT_GRAPHER_ENTITY_TYPE } from "../core/GrapherConstants"

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
    table: OwidTable // not used here, but required in type `ChartManager`
    tableForDisplay: OwidTable
    entityType?: string
    endTime?: Time
    startTime?: Time
    dataTableSlugs?: ColumnSlug[]
    showSelectionOnlyInDataTable?: boolean
    entitiesAreCountryLike?: boolean
    isSmall?: boolean
    isMedium?: boolean
    isNarrow?: boolean
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
        let table = this.manager.tableForDisplay
        if (this.manager.showSelectionOnlyInDataTable) {
            table = table.filterByEntityNames(
                this.selectionArray.selectedEntityNames
            )
        }
        return table
    }

    @computed get manager(): DataTableManager {
        return (
            this.props.manager ?? {
                table: BlankOwidTable(),
                tableForDisplay: BlankOwidTable(),
            }
        )
    }

    @computed private get entityType(): string {
        return this.manager.entityType ?? DEFAULT_GRAPHER_ENTITY_TYPE
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
        return (
            !this.hasDimensionHeaders ||
            this.displayDimensions.some((header) => header.columns.length > 1)
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

    private get entityHeaderText(): string {
        // if the entities are country-like and we do have aggregate rows,
        // then we prefer "Country/area" over "Country or region"
        // (note that we honour the entity type provided by the author if it is given)
        if (
            this.entityType === DEFAULT_GRAPHER_ENTITY_TYPE &&
            this.showTitleForAggregateRows
        )
            return "Country/area"
        return capitalize(this.entityType)
    }

    private get entityHeader(): JSX.Element {
        const { sort } = this.tableState
        return (
            <ColumnHeader
                key="entity"
                sortable={this.entityCount > 1}
                sortedCol={sort.dimIndex === ENTITY_DIM_INDEX}
                sortOrder={sort.order}
                onClick={(): void => this.updateSort(ENTITY_DIM_INDEX)}
                headerText={this.entityHeaderText}
                colType="entity"
            />
        )
    }

    @computed private get hasDimensionHeaders(): boolean {
        return this.displayDimensions.length > 1
    }

    // If the table has a single data column, we move the data column
    // closer to the entity column to make it easier to read the table
    @computed private get singleDataColumnStyle():
        | {
              minWidth: number
              contentMaxWidth: number
          }
        | undefined {
        // no need to do this on mobile
        if (this.manager.isNarrow) return

        const hasSingleDataColumn =
            this.displayDimensions.length === 1 &&
            this.displayDimensions[0].columns.length === 1

        if (!hasSingleDataColumn) return

        // header text
        const dimension = this.displayDimensions[0]
        const column = this.displayDimensions[0].columns[0]
        const headerText = this.subheaderText(column, dimension)

        // display values
        const values = excludeUndefined(
            this.displayRows.map(
                (row) => (row?.dimensionValues[0] as SingleValue).single
            )
        )

        const accessor = (v: Value): number | undefined =>
            typeof v.value === "string" ? v.value.length : v.value
        const maxValue = maxBy(values, accessor)
        const minValue = minBy(values, accessor)

        const measureWidth = (text: string): number =>
            Bounds.forText(text, { fontSize: 14 }).width

        // in theory, we should be measuring the length of all values
        // but we might have a lot of values, so we just measure the length
        // of the min and max values as a proxy
        const contentMaxWidth = Math.ceil(
            Math.max(
                measureWidth(maxValue?.displayValue ?? "") + 20, // 20px accounts for a possible info icon
                measureWidth(minValue?.displayValue ?? "") + 20, // 20px accounts for a possible info icon
                measureWidth(headerText) + 26 // 26px accounts for the sort icon
            )
        )

        // minimum width of the column
        const minWidth = 0.66 * this.bounds.width

        // only do this if there is an actual need
        if (minWidth - contentMaxWidth < 320) return

        return { minWidth, contentMaxWidth }
    }

    private get dimensionHeaders(): JSX.Element[] | null {
        const { sort } = this.tableState
        return this.displayDimensions.map((dim, dimIndex) => {
            const { coreTableColumn, display } = dim
            const targetTime =
                dim.columns.length === 1 ? dim.columns[0].targetTime : undefined

            const dimensionHeaderText = (
                <React.Fragment>
                    <div className="name">
                        {upperFirst(display.columnName.title)}{" "}
                        <span className="title-fragments">
                            {joinTitleFragments(
                                display.columnName.attributionShort,
                                display.columnName.titleVariant
                            )}
                        </span>
                    </div>
                    <div className="description">
                        <span className="unit">{display.unit}</span>{" "}
                        <span className="divider">
                            {display.unit && targetTime !== undefined && "•"}
                        </span>{" "}
                        <span className="time">
                            {targetTime !== undefined &&
                                coreTableColumn.formatTime(targetTime)}
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
                colSpan: dim.columns.length,
                headerText: dimensionHeaderText,
                colType: "dimension" as const,
            }

            return <ColumnHeader key={coreTableColumn.slug} {...props} />
        })
    }

    private subheaderText(
        column: DataTableColumn,
        dimension: DataTableDimension
    ): string {
        return isDeltaColumn(column.key)
            ? columnNameByType[column.key]
            : dimension.coreTableColumn.formatTime(column.targetTime!)
    }

    private get dimensionSubheaders(): JSX.Element[][] {
        const { sort } = this.tableState
        return this.displayDimensions.map((dim, dimIndex) =>
            dim.columns.map((column, i) => {
                const headerText = this.subheaderText(column, dim)
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
                        subdimensionType={column.key}
                        lastSubdimension={i === dim.columns.length - 1}
                        minWidth={this.singleDataColumnStyle?.minWidth}
                        contentMaxWidth={
                            this.singleDataColumnStyle?.contentMaxWidth
                        }
                    />
                )
            })
        )
    }

    private get headerRow(): JSX.Element {
        const { hasDimensionHeaders, hasSubheaders } = this
        return hasDimensionHeaders && hasSubheaders ? (
            <>
                <tr>
                    <th className="above-entity" />
                    {this.dimensionHeaders}
                </tr>
                <tr>
                    {this.entityHeader}
                    {this.dimensionSubheaders}
                </tr>
            </>
        ) : (
            <tr>
                {this.entityHeader}
                {hasSubheaders
                    ? this.dimensionSubheaders
                    : this.dimensionHeaders}
            </tr>
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
            return (
                <td
                    key={key}
                    className={classnames([
                        "dimension",
                        `dimension-${column.key}`,
                    ])}
                />
            )

        let value: Value | undefined

        if (isSingleValue(dv)) value = dv[column.key as SingleValueKey] as Value
        else if (isRangeValue(dv))
            value = dv[column.key as RangeValueKey] as Value

        if (value === undefined)
            return (
                <td
                    key={key}
                    className={classnames([
                        "dimension",
                        `dimension-${column.key}`,
                    ])}
                />
            )

        const shouldShowClosestTimeNotice =
            value.time !== undefined &&
            !isDeltaColumn(column.key) &&
            column.targetTime !== undefined &&
            column.targetTime !== value.time

        const { contentMaxWidth } = this.singleDataColumnStyle ?? {}

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
                <CellContent maxWidth={contentMaxWidth}>
                    {shouldShowClosestTimeNotice &&
                        makeClosestTimeNotice(
                            actualColumn.formatTime(column.targetTime!),
                            actualColumn.formatTime(value.time!) // todo: add back format: "MMM D",
                        )}
                    <span>{value.displayValue}</span>
                </CellContent>
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

    @computed private get valueEntityRows(): JSX.Element[] {
        return this.sortedEntityRows.map((row) =>
            this.renderEntityRow(row, this.displayDimensions)
        )
    }

    @computed private get valueAggregateRows(): JSX.Element[] {
        return this.sortedAggregateRows.map((row) =>
            this.renderEntityRow(row, this.displayDimensions)
        )
    }

    @computed get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    @computed private get titleForAggregateRows(): JSX.Element | null {
        if (!this.showTitleForAggregateRows) return null
        return (
            <tr className="title">
                <td>Other</td>
                {range(this.numberOfColumnsWithValues).map((i) => (
                    <td key={i} />
                ))}
            </tr>
        )
    }

    @computed private get numberOfColumnsWithValues(): number {
        return this.columnsWithValues.reduce(
            (columnCount, item) => columnCount + item.columns.length,
            0
        )
    }

    @computed private get tableCaption(): JSX.Element | null {
        if (this.hasDimensionHeaders) return null
        const singleDimension = this.displayDimensions[0]
        const titleFragments = (singleDimension.display.columnName
            .attributionShort ||
            singleDimension.display.columnName.titleVariant) && (
            <>
                <span className="title-fragments">
                    {joinTitleFragments(
                        singleDimension.display.columnName.attributionShort,
                        singleDimension.display.columnName.titleVariant
                    )}
                </span>
            </>
        )
        const separator =
            (singleDimension.display.columnName.attributionShort ||
                singleDimension.display.columnName.titleVariant) &&
            singleDimension.display.unit
                ? " – "
                : " "

        return singleDimension ? (
            <div className="caption">
                {singleDimension.display.columnName.title} {titleFragments}
                {separator}
                {singleDimension.display.unit && (
                    <span className="unit">{singleDimension.display.unit}</span>
                )}
            </div>
        ) : null
    }

    render(): JSX.Element {
        return (
            <div className="DataTable">
                {this.tableCaption}
                <div className="table-wrapper">
                    <table>
                        <thead>{this.headerRow}</thead>
                        <tbody>
                            {this.valueEntityRows}
                            {this.titleForAggregateRows}
                            {this.valueAggregateRows}
                        </tbody>
                    </table>
                </div>
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

    @computed private get entityCount(): number {
        return this.entityNames.length
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
                  useNoBreakSpace: true,
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
        sourceColumn: CoreColumn,
        targetTimes: number[]
    ): Map<string, (DataValue | undefined)[]> {
        return valuesByEntityAtTimes(
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
                    typeof end.value === "number" &&
                    // sanity check: start time should always be <= end time
                    start.time !== undefined &&
                    end.time !== undefined &&
                    start.time <= end.time
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
        const { entityCount } = this
        // Todo: for sorting etc, use CoreTable?
        return this.columnsWithValues.map((d) => {
            const coreTableColumn = d.sourceColumn
            const unit =
                coreTableColumn.unit === "%" ? "percent" : coreTableColumn.unit

            const columnName = coreTableColumn.titlePublicOrDisplayName

            return {
                coreTableColumn,
                // A top-level header is only sortable if it has a single nested column, because
                // in that case the nested column is not rendered.
                sortable: d.columns.length === 1,
                columns: d.columns.map((column) => ({
                    ...column,
                    sortable: entityCount > 1,
                })),
                display: { columnName, unit },
            }
        })
    }

    @computed private get sortedEntityRows(): DataTableRow[] {
        const { order } = this.tableState.sort
        return orderBy(this.displayEntityRows, this.sortValueMapper, order)
    }

    @computed private get sortedAggregateRows(): DataTableRow[] {
        const { order } = this.tableState.sort
        return orderBy(this.displayAggregateRows, this.sortValueMapper, order)
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

    @computed private get displayEntityRows(): DataTableRow[] {
        if (!this.manager.entitiesAreCountryLike) return this.displayRows
        return this.displayRows.filter((row) => isCountryName(row.entityName))
    }

    @computed private get displayAggregateRows(): DataTableRow[] {
        if (!this.manager.entitiesAreCountryLike) return []
        return this.displayRows.filter((row) => !isCountryName(row.entityName))
    }

    @computed private get showTitleForAggregateRows(): boolean {
        return (
            !!this.manager.entitiesAreCountryLike &&
            this.displayEntityRows.length > 0 &&
            this.displayAggregateRows.length > 0
        )
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
    subdimensionType?: ColumnKey
    lastSubdimension?: boolean
    minWidth?: number
    contentMaxWidth?: number
}): JSX.Element {
    const { sortable, sortedCol, colType, subdimensionType, lastSubdimension } =
        props
    const isEntityColumn = colType === "entity"
    const sortIcon = sortable && (
        <SortIcon
            isActiveIcon={sortedCol}
            order={
                sortedCol
                    ? props.sortOrder
                    : isEntityColumn
                    ? SortOrder.asc
                    : SortOrder.desc
            }
        />
    )

    return (
        <th
            className={classnames(colType, {
                sortable,
                sorted: sortedCol,
                firstSubdimension: subdimensionType === "start",
                endSubdimension: subdimensionType === "end",
                lastSubdimension,
                deltaColumn: isDeltaColumn(subdimensionType),
            })}
            rowSpan={props.rowSpan ?? 1}
            colSpan={props.colSpan ?? 1}
            onClick={props.onClick}
            style={{ minWidth: props.minWidth }}
        >
            <CellContent maxWidth={props.contentMaxWidth}>
                <div className="content">
                    {!isEntityColumn && sortIcon}
                    <span>{props.headerText}</span>
                    {isEntityColumn && sortIcon}
                </div>
            </CellContent>
        </th>
    )
}

function CellContent(props: {
    maxWidth?: number
    children?: React.ReactNode
}): JSX.Element {
    if (!props.maxWidth) return <>{props.children}</>
    return <div style={{ maxWidth: props.maxWidth }}>{props.children}</div>
}

function SortIcon(props: {
    isActiveIcon?: boolean
    order: SortOrder
}): JSX.Element {
    const isActiveIcon = props.isActiveIcon ?? false
    const activeIcon =
        props.order === SortOrder.desc ? faArrowUpLong : faArrowDownLong

    return (
        <span
            className={classnames({ "sort-icon": true, active: isActiveIcon })}
        >
            {isActiveIcon ? (
                <FontAwesomeIcon icon={activeIcon} />
            ) : (
                <span style={{ display: "inline-block", width: "max-content" }}>
                    <FontAwesomeIcon icon={faArrowUpLong} />
                    <FontAwesomeIcon
                        icon={faArrowDownLong}
                        style={{ marginLeft: "-2px" }}
                    />
                </span>
            )}
        </span>
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
    display: { columnName: IndicatorTitleWithFragments; unit?: string }
}

interface DataTableRow {
    entityName: EntityName
    dimensionValues: (DimensionValue | undefined)[] // TODO make it not undefined
}

function isDeltaColumn(columnKey?: ColumnKey): boolean {
    return columnKey === "delta" || columnKey === "deltaRatio"
}
