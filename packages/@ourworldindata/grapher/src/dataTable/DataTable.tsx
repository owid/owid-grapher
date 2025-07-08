import * as _ from "lodash-es"
import * as React from "react"
import { computed, observable, action, makeObservable } from "mobx"
import { observer } from "mobx-react"
import classnames from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import {
    faArrowDownLong,
    faArrowUpLong,
    faInfoCircle,
} from "@fortawesome/free-solid-svg-icons"
import { scaleLinear } from "d3-scale"
import { extent } from "d3-array"
import { line } from "d3-shape"
import {
    SortOrder,
    Time,
    EntityName,
    OwidTableSlugs,
    OwidVariableRoundingMode,
    OwidVariableRow,
} from "@ourworldindata/types"
import { OwidTable, CoreColumn } from "@ourworldindata/core-table"
import {
    valuesByEntityAtTimes,
    es6mapValues,
    exposeInstanceOnWindow,
    DataValue,
    Bounds,
    DEFAULT_BOUNDS,
    TickFormattingOptions,
    Tippy,
    excludeUndefined,
    joinTitleFragments,
    FuzzySearch,
} from "@ourworldindata/utils"
import { SelectionArray } from "../selection/SelectionArray"
import {
    DEFAULT_GRAPHER_ENTITY_TYPE,
    SVG_STYLE_PROPS,
} from "../core/GrapherConstants"
import * as R from "remeda"
import { makeSelectionArray } from "../chart/ChartUtils"
import { isEntityRegionType } from "../core/EntitiesByRegionType"
import { match } from "ts-pattern"
import { NoDataModal } from "../noDataModal/NoDataModal"
import {
    DataTableColumnKey,
    DisplayDataTableDimension,
    DataTableRow,
    DataTableDimension,
    DataTableColumnDefinition,
    DataTableValuesForEntity,
    RangeValuesForEntity,
    RangeColumnKey,
    PointValuesForEntity,
    PointColumnKey,
    SparklineHighlight,
    TargetTimeMode,
    MinimalOwidRow,
    DataTableConfig,
    DataTableSortState,
    DataTableState,
    DimensionSortIndex,
    DataTableManager,
    CommonDataTableFilter,
    COMMON_DATA_TABLE_FILTERS,
    DataTableFilter,
    SparklineKey,
} from "./DataTableConstants"
import { GRAY_30 } from "../color/ColorConstants"

const ENTITY_SORT_INDEX = -1

const DEFAULT_SORT_STATE: DataTableSortState = {
    dimIndex: ENTITY_SORT_INDEX,
    columnKey: undefined,
    order: SortOrder.asc,
}

const columnNameByType: Record<DataTableColumnKey, string> = {
    single: "Value",
    start: "Start",
    end: "End",
    delta: "Absolute Change",
    deltaRatio: "Relative Change",
    sparkline: "Sparkline",
}

const inverseSortOrder = (order: SortOrder): SortOrder =>
    order === SortOrder.asc ? SortOrder.desc : SortOrder.asc

@observer
export class DataTable extends React.Component<{
    manager: DataTableManager
    bounds?: Bounds
}> {
    @observable private storedState: DataTableState = {
        sort: DEFAULT_SORT_STATE,
    }

    constructor(props: { manager: DataTableManager; bounds?: Bounds }) {
        super(props)
        makeObservable(this)
    }

    @computed get manager(): DataTableManager {
        return this.props.manager
    }

    @computed private get selectionArray(): SelectionArray {
        return makeSelectionArray(this.manager.dataTableSelection)
    }

    @computed private get tableConfig(): DataTableConfig {
        return this.manager.dataTableConfig
    }

    @computed private get timelineMinTime(): Time | undefined {
        return this.manager.closestTimelineMinTime
    }

    @computed private get timelineMaxTime(): Time | undefined {
        return this.manager.closestTimelineMaxTime
    }

    @computed get table(): OwidTable {
        let table = this.manager.tableForDisplay

        // make sure the given table doesn't contain any rows outside of the time range
        table = table.filterByTimeRange(
            this.manager.closestTimelineMinTime ?? -Infinity,
            this.manager.closestTimelineMaxTime ?? Infinity
        )

        // apply the region type filter if given
        const keepEntityNames = this.filteredEntityNames
        if (keepEntityNames && keepEntityNames.length > 0)
            table = table.filterByEntityNames(keepEntityNames)

        return table
    }

    @computed private get filteredEntityNames(): EntityName[] | undefined {
        const { filter } = this.tableConfig

        if (isEntityRegionType(filter))
            return this.manager.entityNamesByRegionType?.get(filter)

        return match(filter)
            .with("all", () => undefined) // no filter
            .with("selection", () =>
                this.selectionArray.hasSelection
                    ? this.selectionArray.selectedEntityNames
                    : undefined
            )
            .exhaustive()
    }

    @computed private get tableState(): DataTableState {
        return { sort: this.sortState }
    }

    @computed private get sortState(): DataTableSortState {
        let { dimIndex, columnKey, order } = {
            ...DEFAULT_SORT_STATE,
            ...this.storedState.sort,
        }

        // If not sorted by entity, then make sure the index of the chosen column exists
        dimIndex = Math.min(dimIndex, this.table.numColumns - 1)
        if (dimIndex !== ENTITY_SORT_INDEX) {
            const availableColumns = this.dataTableDimensionsWithValues[
                dimIndex
            ].columnDefinitions.map((colDef) => colDef.key)
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

    @computed private get entityType(): string {
        return this.manager.entityType ?? DEFAULT_GRAPHER_ENTITY_TYPE
    }

    @computed private get sortValueMapper(): (
        row: DataTableRow
    ) => number | string {
        const { dimIndex: sortIndex, columnKey, order } = this.tableState.sort
        if (sortIndex === ENTITY_SORT_INDEX)
            return (row): string => row.entityName

        return (row): string | number => {
            const dv = row.values[sortIndex] as DataTableValuesForEntity

            let value: number | string | undefined
            if (dv) {
                if (isSingleValue(dv)) {
                    value = dv.single?.value
                } else if (
                    isRangeValue(dv) &&
                    columnKey !== undefined &&
                    isRangeColumnKey(columnKey)
                ) {
                    value = dv[columnKey]?.value
                }
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
            this.dataTableDimensionsWithValues.some(
                (header) => header.columnDefinitions.length > 1
            )
        )
    }

    @action.bound private updateSort(
        dimIndex: DimensionSortIndex,
        columnKey?: DataTableColumnKey
    ): void {
        const { sort } = this.tableState
        const order =
            sort.dimIndex === dimIndex && sort.columnKey === columnKey
                ? inverseSortOrder(sort.order)
                : dimIndex === ENTITY_SORT_INDEX
                  ? SortOrder.asc
                  : SortOrder.desc

        this.storedState.sort.dimIndex = dimIndex
        this.storedState.sort.columnKey = columnKey
        this.storedState.sort.order = order
    }

    private get entityHeaderText(): string {
        return _.capitalize(this.entityType)
    }

    private get entityHeader(): React.ReactElement {
        const { sort } = this.tableState
        return (
            <ColumnHeader
                key="entity"
                sortable={this.entityCount > 1}
                sortedCol={sort.dimIndex === ENTITY_SORT_INDEX}
                sortOrder={sort.order}
                onClick={(): void => this.updateSort(ENTITY_SORT_INDEX)}
                headerText={this.entityHeaderText}
                colType="entity"
            />
        )
    }

    @computed private get hasDimensionHeaders(): boolean {
        return this.dataTableDimensionsWithValues.length > 1
    }

    // If the table has a single data column, we move the data column
    // closer to the entity column to make it easier to read the table
    @computed private get singleDataColumnStyle():
        | { minWidth: number; contentMaxWidth: number }
        | undefined {
        // no need to do this on mobile
        if (this.manager.isNarrow) return

        const hasSingleDataColumn =
            this.displayDimensions.length === 1 &&
            this.displayDimensions[0].columnDefinitions.length === 1

        if (!hasSingleDataColumn) return

        // header text
        const dimension = this.displayDimensions[0]
        const column = this.displayDimensions[0].columnDefinitions[0]
        const headerText = this.subheaderText(column, dimension)

        // display values
        const values = excludeUndefined(
            this.displayRows.map(
                (row) => (row?.values[0] as PointValuesForEntity).single
            )
        )

        const accessor = (row: MinimalOwidRow): number | undefined =>
            typeof row.value === "string" ? row.value.length : row.value
        const maxValue = _.maxBy(values, accessor)
        const minValue = _.minBy(values, accessor)

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

    private get dimensionHeaders(): React.ReactElement[] | null {
        const { sort } = this.tableState
        return this.displayDimensions.map((dim, dimIndex) => {
            const { coreTableColumn, display } = dim
            const singleColumn = dim.columnDefinitions.find(
                (column) => column.key === PointColumnKey.single
            )
            const targetTime = singleColumn?.targetTime

            const dimensionHeaderText = (
                <React.Fragment>
                    <div className="name">
                        {_.upperFirst(display.columnName.title)}{" "}
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

            const onClick = dim.sortable
                ? (): void => this.updateSort(dimIndex, PointColumnKey.single)
                : undefined

            const props = {
                sortable: dim.sortable,
                sortedCol: dim.sortable && sort.dimIndex === dimIndex,
                sortOrder: sort.order,
                onClick,
                colSpan: dim.columnDefinitions.length,
                headerText: dimensionHeaderText,
                colType: "dimension" as const,
            }

            return <ColumnHeader key={coreTableColumn.slug} {...props} />
        })
    }

    private subheaderText(
        column: DataTableColumnDefinition,
        dimension: DisplayDataTableDimension
    ): string {
        const col = dimension.coreTableColumn

        if (column.key === SparklineKey.sparkline) {
            const minTime = col.formatTime(this.timelineMinTime!)
            const maxTime = col.formatTime(this.timelineMaxTime!)
            return `${minTime}–${maxTime}`
        }

        return isDeltaColumn(column.key)
            ? columnNameByType[column.key]
            : col.formatTime(column.targetTime!)
    }

    private get dimensionSubheaders(): React.ReactElement[][] {
        const { sort } = this.tableState
        return this.displayDimensions.map((dim, dimIndex) =>
            dim.columnDefinitions.map((column, colIndex) => {
                const headerText = this.subheaderText(column, dim)
                const onClick = column.sortable
                    ? (): void => this.updateSort(dimIndex, column.key)
                    : undefined
                return (
                    <ColumnHeader
                        key={column.key}
                        sortable={column.sortable}
                        sortedCol={
                            sort.dimIndex === dimIndex &&
                            sort.columnKey === column.key
                        }
                        sortOrder={sort.order}
                        onClick={onClick}
                        headerText={headerText}
                        colType="subdimension"
                        classNames={classnames({
                            "subdimension-first": colIndex === 0,
                        })}
                        minWidth={this.singleDataColumnStyle?.minWidth}
                        contentMaxWidth={
                            this.singleDataColumnStyle?.contentMaxWidth
                        }
                    />
                )
            })
        )
    }

    private get headerRow(): React.ReactElement {
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

    private renderValueCellContent({
        columnDefinition,
        valuesForEntity,
        formatTime,
    }: {
        columnDefinition: DataTableColumnDefinition
        valuesForEntity?: DataTableValuesForEntity
        formatTime: (time: Time) => string
    }): React.ReactElement | null {
        if (!valuesForEntity) return null
        if (!(columnDefinition.key in valuesForEntity)) return null

        const value = getValueForEntityByKey(
            valuesForEntity,
            columnDefinition.key
        )
        if (!value) return null

        return (
            <>
                <ClosestTimeNotice
                    value={value}
                    columnDefinition={columnDefinition}
                    formatTime={formatTime}
                />
                <span>{value.displayValue}</span>
            </>
        )
    }

    private renderSparklineCellContent({
        columnDefinition,
        valuesForEntity,
        isProjection,
    }: {
        columnDefinition: DataTableColumnDefinition
        valuesForEntity?: DataTableValuesForEntity
        isProjection?: boolean
    }): React.ReactElement | null {
        if (
            columnDefinition.key !== SparklineKey.sparkline ||
            !valuesForEntity?.sparkline
        )
            return null

        const highlights: SparklineHighlight[] = []

        const start = isRangeValue(valuesForEntity)
            ? valuesForEntity.start
            : valuesForEntity.single
        const startTime = start?.time ?? this.targetTimes?.[0]

        const end = isRangeValue(valuesForEntity)
            ? valuesForEntity.end
            : valuesForEntity.single
        const endTime = end?.time ?? this.targetTimes?.[1]

        // Add a highlight for the start time
        if (startTime !== undefined) {
            const value =
                typeof start?.value === "string" ? undefined : start?.value

            const showMarker =
                this.manager.timelineDragTarget === "start" ||
                this.manager.timelineDragTarget === "both"

            highlights.push({ time: startTime, value, showMarker })
        }

        // Add a highlight for the end time
        if (endTime !== undefined && endTime !== startTime) {
            const value =
                typeof end?.value === "string" ? undefined : end?.value

            const showMarker =
                this.manager.timelineDragTarget === "end" ||
                this.manager.timelineDragTarget === "both"

            highlights.push({ time: endTime, value, showMarker })
        }

        return (
            <Sparkline
                owidRows={valuesForEntity.sparkline}
                minTime={this.timelineMinTime!}
                maxTime={this.timelineMaxTime!}
                highlights={highlights}
                strokeStyle={isProjection ? "dotted" : "solid"}
            />
        )
    }

    private renderEntityRow(
        row: DataTableRow,
        dimensions: DisplayDataTableDimension[]
    ): React.ReactElement {
        return (
            <tr key={row.entityName}>
                <td key="entity" className={classnames({ entity: true })}>
                    {row.entityName}
                </td>

                {row.values.map((valuesForEntity, dimIndex) => {
                    const dimension = dimensions[dimIndex]
                    const { isProjection } = dimension.coreTableColumn

                    return dimension.columnDefinitions.map(
                        (columnDefinition, colIndex) => {
                            const key = `${dimIndex}-${colIndex}`
                            const formatTime = (time: Time): string =>
                                dimension.coreTableColumn.formatTime(time)

                            if (columnDefinition.key === SparklineKey.sparkline)
                                return (
                                    <ValueCell
                                        key={key}
                                        columnKey={columnDefinition.key}
                                        isFirstColumn={colIndex === 0}
                                    >
                                        {this.renderSparklineCellContent({
                                            columnDefinition,
                                            valuesForEntity,
                                            isProjection,
                                        })}
                                    </ValueCell>
                                )

                            return (
                                <ValueCell
                                    key={key}
                                    columnKey={columnDefinition.key}
                                    isFirstColumn={colIndex === 0}
                                    maxWidth={
                                        this.singleDataColumnStyle
                                            ?.contentMaxWidth
                                    }
                                >
                                    {this.renderValueCellContent({
                                        columnDefinition,
                                        valuesForEntity,
                                        formatTime,
                                    })}
                                </ValueCell>
                            )
                        }
                    )
                })}
            </tr>
        )
    }

    @computed get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    @computed private get tableCaption(): React.ReactElement | null {
        if (this.hasDimensionHeaders) return null
        if (this.displayDimensions.length === 0) return null

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

    private renderNoDataModal(): React.ReactElement {
        return (
            <svg
                width={this.bounds.width}
                height={this.bounds.height}
                style={SVG_STYLE_PROPS}
            >
                <NoDataModal
                    manager={this.manager}
                    bounds={this.bounds}
                    message={`No ${this.entityType} matches this query`}
                    helpText="Try checking for typos or searching for something else"
                    hideTextOutline
                />
            </svg>
        )
    }

    render(): React.ReactElement | null {
        if (this.sortedDisplayRows.length === 0) return this.renderNoDataModal()

        return (
            <div className="DataTable">
                {this.tableCaption}
                <div className="table-wrapper">
                    <table>
                        <thead>{this.headerRow}</thead>
                        <tbody>
                            {this.sortedDisplayRows.map((row) =>
                                this.renderEntityRow(
                                    row,
                                    this.displayDimensions
                                )
                            )}
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

        if (!this.loadedWithData) return undefined

        const numEntitiesInTable = this.entityNames.length

        this.columnsToShow.forEach((column): boolean => {
            const numberOfEntitiesWithDataSortedByTime = _.sortBy(
                Object.entries(R.countBy(column.uniqTimesAsc, R.identity())),
                ([time, _count]) => parseInt(time)
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

    @computed private get availableEntityNames(): EntityName[] {
        return _.union(
            ...this.columnsToShow.map(
                (col) => this.table.get(col.slug).uniqEntityNames
            )
        )
    }

    @computed get fuzzy(): FuzzySearch<string> {
        return FuzzySearch.withKey(
            this.availableEntityNames,
            (entityName) => entityName
        )
    }

    @computed private get entityNames(): EntityName[] {
        if (!this.tableConfig.search) return this.availableEntityNames
        return this.fuzzy.search(this.tableConfig.search)
    }

    @computed private get entityCount(): number {
        return this.entityNames.length
    }

    @computed private get isSortable(): boolean {
        return this.entityCount > 1
    }

    componentDidMount(): void {
        exposeInstanceOnWindow(this, "dataTable")
    }

    private formatValue(
        column: CoreColumn,
        value: number | string | undefined,
        formattingOverrides?: TickFormattingOptions
    ): string | undefined {
        if (value === undefined) return undefined
        return column.formatValueShort(value, {
            roundingMode: OwidVariableRoundingMode.decimalPlaces,
            numberAbbreviation: false,
            trailingZeroes: true,
            useNoBreakSpace: true,
            ...formattingOverrides,
        })
    }

    @computed get targetTimes(): [number] | [number, number] | undefined {
        const { startTime, endTime } = this.manager
        if (startTime === undefined || endTime === undefined) return undefined

        if (startTime !== endTime) return [startTime, endTime]
        return [endTime]
    }

    private getTargetTimesForColumn(
        coreTableColumn: CoreColumn
    ): [number] | [number, number] {
        // Respect the column's target time if it's set
        if (coreTableColumn.def.targetTime !== undefined)
            return [coreTableColumn.def.targetTime]

        // Otherwise, use the table's target times
        if (this.targetTimes !== undefined) return this.targetTimes

        return [coreTableColumn.maxTime]
    }

    @computed get dataTableDimensionsWithValues(): DataTableDimension[] {
        return this.columnsToShow.map((coreTableColumn) => {
            const targetTimes = this.getTargetTimesForColumn(coreTableColumn)
            const targetTimeMode =
                targetTimes.length < 2
                    ? TargetTimeMode.point
                    : TargetTimeMode.range

            // Get values for the given target times and apply tolerance
            const targetValuesByEntity = this.interpolateTargetValues({
                coreTableColumn,
                targetTimes,
            })

            // Add absolute and relative change columns if necessary
            const valuesByEntityName =
                this.calculateDataValuesForTargetTimeMode({
                    targetValuesByEntity,
                    coreTableColumn,
                    targetTimeMode,
                })

            // Add data for sparklines
            if (this.columnHasSparkline(coreTableColumn)) {
                for (const [entityName, values] of valuesByEntityName) {
                    values.sparkline =
                        coreTableColumn.owidRowsByEntityName.get(entityName)
                }
            }

            // Construct column definitions for the given target time mode
            const columnDefinitions = this.constructColumnDefinitions({
                coreTableColumn,
                targetTimes,
                targetTimeMode,
            })

            return { columnDefinitions, valuesByEntityName, coreTableColumn }
        })
    }

    private columnHasSparkline(coreTableColumn: CoreColumn): boolean {
        return (
            this.timelineMinTime !== undefined &&
            this.timelineMaxTime !== undefined &&
            this.timelineMinTime !== this.timelineMaxTime &&
            coreTableColumn.hasNumberFormatting &&
            // For columns with a target time, the data table is fixed at that time.
            // It thus doesn't make sense to show a sparkline
            coreTableColumn.def.targetTime === undefined
        )
    }

    private constructColumnDefinitions({
        coreTableColumn,
        targetTimes,
        targetTimeMode,
    }: {
        coreTableColumn: CoreColumn
        targetTimes: number[]
        targetTimeMode: TargetTimeMode
    }): DataTableColumnDefinition[] {
        // Inject delta columns if the data is numerical and we have start & end
        // values to compare in the table. One column for absolute difference,
        // another for % difference.
        const deltaColumns: DataTableColumnDefinition[] = []
        if (coreTableColumn.hasNumberFormatting) {
            if (targetTimeMode === TargetTimeMode.range) {
                const { tableDisplay = {} } = coreTableColumn.display ?? {}
                if (!tableDisplay.hideAbsoluteChange)
                    deltaColumns.push({
                        key: RangeColumnKey.delta,
                        sortable: this.isSortable,
                    })
                if (!tableDisplay.hideRelativeChange)
                    deltaColumns.push({
                        key: RangeColumnKey.deltaRatio,
                        sortable: this.isSortable,
                    })
            }
        }

        const valueColumns: DataTableColumnDefinition[] = targetTimes.map(
            (targetTime, index) => ({
                key:
                    targetTimeMode === TargetTimeMode.range
                        ? index === 0
                            ? RangeColumnKey.start
                            : RangeColumnKey.end
                        : PointColumnKey.single,
                targetTime,
                sortable: this.isSortable,
            })
        )

        // Show a column with sparklines if appropriate
        const sparklineColumn = this.columnHasSparkline(coreTableColumn)
            ? { key: SparklineKey.sparkline, sortable: false }
            : undefined

        return excludeUndefined([
            ...valueColumns,
            sparklineColumn,
            ...deltaColumns,
        ])
    }

    private interpolateTargetValues({
        coreTableColumn,
        targetTimes,
    }: {
        coreTableColumn: CoreColumn
        targetTimes: number[]
    }): Map<string, (DataValue | undefined)[]> {
        return valuesByEntityAtTimes(
            coreTableColumn.valueByEntityNameAndOriginalTime,
            targetTimes,
            coreTableColumn.tolerance
        )
    }

    private calculateDataValuesForTargetTimeMode({
        targetValuesByEntity,
        targetTimeMode,
        coreTableColumn,
    }: {
        targetValuesByEntity: Map<string, (DataValue | undefined)[]>
        targetTimeMode: TargetTimeMode
        coreTableColumn: CoreColumn
    }): Map<string, DataTableValuesForEntity> {
        return es6mapValues(targetValuesByEntity, (dvs) => {
            // There is always a column, but not always a data value (in the delta column the
            // value needs to be calculated)
            if (targetTimeMode === TargetTimeMode.range) {
                const [start, end]: (MinimalOwidRow | undefined)[] = dvs
                const result: RangeValuesForEntity = {
                    start: {
                        ...start,
                        displayValue: this.formatValue(
                            coreTableColumn,
                            start?.value
                        ),
                    },
                    end: {
                        ...end,
                        displayValue: this.formatValue(
                            coreTableColumn,
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
                            coreTableColumn,
                            deltaValue,
                            {
                                showPlus: true,
                                unit:
                                    coreTableColumn.shortUnit === "%"
                                        ? "pp"
                                        : coreTableColumn.shortUnit,
                            }
                        ),
                    }

                    result.deltaRatio = {
                        value: deltaRatioValue,
                        displayValue:
                            isFinite(deltaRatioValue) && !isNaN(deltaRatioValue)
                                ? this.formatValue(
                                      coreTableColumn,
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
                const result: PointValuesForEntity = {
                    single: { ...dv },
                }
                if (dv !== undefined)
                    result.single!.displayValue = this.formatValue(
                        coreTableColumn,
                        dv.value
                    )
                return result
            }
        })
    }

    @computed get displayDimensions(): DisplayDataTableDimension[] {
        return this.dataTableDimensionsWithValues.map((d) => {
            const coreTableColumn = d.coreTableColumn
            const columnName = coreTableColumn.titlePublicOrDisplayName
            const unit =
                coreTableColumn.unit === "%" ? "percent" : coreTableColumn.unit

            return {
                coreTableColumn,
                columnDefinitions: d.columnDefinitions,
                display: { columnName, unit },
                sortable: !this.hasSubheaders,
            }
        })
    }

    @computed private get displayRows(): DataTableRow[] {
        return this.entityNames.map((entityName) => {
            return {
                entityName,
                values: this.dataTableDimensionsWithValues.map((d) =>
                    d.valuesByEntityName.get(entityName)
                ),
            }
        })
    }

    @computed private get sortedDisplayRows(): DataTableRow[] {
        const { order } = this.tableState.sort
        return _.orderBy(this.displayRows, this.sortValueMapper, order)
    }
}

function ColumnHeader(props: {
    classNames?: string
    sortable: boolean
    sortedCol: boolean
    sortOrder: SortOrder
    onClick?: () => void
    rowSpan?: number
    colSpan?: number
    headerText: React.ReactFragment
    colType: "entity" | "dimension" | "subdimension"
    minWidth?: number
    contentMaxWidth?: number
}): React.ReactElement {
    const { sortable, sortedCol, colType } = props
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
            className={classnames(props.classNames, colType, { sortable })}
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
}): React.ReactElement {
    if (!props.maxWidth) return <>{props.children}</>
    return <div style={{ maxWidth: props.maxWidth }}>{props.children}</div>
}

function ValueCell(props: {
    columnKey: DataTableColumnKey
    isFirstColumn?: boolean
    maxWidth?: number
    children?: React.ReactNode
}): React.ReactElement {
    const className = classnames([
        "cell",
        `cell-${props.columnKey}`,
        { "cell-first": props.isFirstColumn },
    ])
    return (
        <td className={className}>
            <CellContent maxWidth={props.maxWidth}>
                {props.children}
            </CellContent>
        </td>
    )
}

function SortIcon(props: {
    isActiveIcon?: boolean
    order: SortOrder
}): React.ReactElement {
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

function ClosestTimeNotice({
    value,
    columnDefinition,
    formatTime,
}: {
    value: MinimalOwidRow
    columnDefinition: DataTableColumnDefinition
    formatTime: (time: Time) => string
}): React.ReactElement | null {
    const shouldShowClosestTimeNotice =
        !isDeltaColumn(columnDefinition.key) &&
        columnDefinition.targetTime !== value.time

    if (
        value.time === undefined ||
        columnDefinition.targetTime === undefined ||
        !shouldShowClosestTimeNotice
    )
        return null

    const targetTime = formatTime(columnDefinition.targetTime)
    const closestTime = formatTime(value.time)

    return (
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
}

function Sparkline({
    width = 75,
    height = 18,
    owidRows,
    minTime,
    maxTime,
    highlights = [],
    dotSize = 3.5,
    color = "#4C6A9C",
    strokeStyle = "solid",
}: {
    width?: number
    height?: number
    owidRows: OwidVariableRow<number>[]
    minTime: number
    maxTime: number
    highlights?: SparklineHighlight[]
    dotSize?: number
    color?: string
    strokeStyle?: "solid" | "dotted"
}): React.ReactElement | null {
    if (owidRows.length <= 1) return null

    // add a little padding so the dots don't overflow
    const bounds = new Bounds(0, 0, width, height).padWidth(dotSize)

    // calculate x-scale
    const xDomain = [minTime, maxTime]
    const xScale = scaleLinear()
        .domain(xDomain)
        .range([bounds.left, bounds.right])

    // calculate y-scale
    const yDomain = extent(owidRows.map((row) => row.value)) as [number, number]
    const yScale = scaleLinear()
        .domain(yDomain)
        .range([bounds.bottom, bounds.top])

    const makePath = line<OwidVariableRow<number>>()
        .x((row) => xScale(row.originalTime))
        .y((row) => yScale(row.value))

    const path = makePath(owidRows)
    if (!path) return null

    const strokeDasharray = strokeStyle === "dotted" ? "2,3" : undefined

    return (
        <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            style={{ overflow: "visible" }}
        >
            {/* marker lines of highlights */}
            {highlights
                .filter((highlight) => highlight.showMarker)
                .map((highlight) => (
                    <line
                        key={highlight.time}
                        x1={xScale(highlight.time)}
                        x2={xScale(highlight.time)}
                        y1={0}
                        y2={height}
                        stroke={GRAY_30}
                    />
                ))}

            {/* sparkline */}
            <path
                d={path}
                stroke={color}
                fill="none"
                strokeWidth={1.5}
                strokeDasharray={strokeDasharray}
            />

            {/* highlighted data points */}
            {highlights
                .filter((highlight) => highlight.value !== undefined)
                .map((highlight) => (
                    <circle
                        key={highlight.time}
                        cx={xScale(highlight.time)}
                        cy={yScale(highlight.value!)}
                        r={dotSize}
                        fill={color}
                        stroke="#fff"
                    />
                ))}
        </svg>
    )
}

function getValueForEntityByKey(
    dimensionValue: DataTableValuesForEntity,
    columnKey: DataTableColumnKey
): MinimalOwidRow | undefined {
    if (isSingleValue(dimensionValue)) {
        return dimensionValue[columnKey as PointColumnKey] as MinimalOwidRow
    } else if (isRangeValue(dimensionValue)) {
        return dimensionValue[columnKey as RangeColumnKey] as MinimalOwidRow
    }
    return undefined
}

function isRangeColumnKey(key: string): key is RangeColumnKey {
    return Object.values(RangeColumnKey).includes(key as any)
}

function isRangeValue(
    value: DataTableValuesForEntity
): value is RangeValuesForEntity {
    return "start" in value
}

function isSingleValue(
    value: DataTableValuesForEntity
): value is PointValuesForEntity {
    return "single" in value
}

function isDeltaColumn(columnKey?: DataTableColumnKey): boolean {
    return columnKey === "delta" || columnKey === "deltaRatio"
}

function isCommonDataTableFilter(
    candidate: string
): candidate is CommonDataTableFilter {
    return COMMON_DATA_TABLE_FILTERS.includes(candidate as any)
}

export function isValidDataTableFilter(
    candidate: string
): candidate is DataTableFilter {
    return isCommonDataTableFilter(candidate) || isEntityRegionType(candidate)
}
