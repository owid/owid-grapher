import * as React from "react"
import { computed, observable, action } from "mobx"
import { observer } from "mobx-react"
import classnames from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faInfoCircle } from "@fortawesome/free-solid-svg-icons/faInfoCircle"
import { Grapher } from "grapher/core/Grapher"
import { SortOrder } from "grapher/core/GrapherConstants"
import { capitalize, orderBy, upperFirst } from "grapher/utils/Util"
import { SortIcon } from "grapher/controls/SortIcon"
import { Tippy } from "grapher/chart/Tippy"
import {
    DataTableRow,
    TargetTimeMode,
    ColumnKey,
    isSingleValue,
    DataTableDimension,
    DataTableColumn,
    DimensionValue,
    isRangeValue,
    RangeValueKey,
    SingleValueKey,
    Value,
} from "./DataTableTransform"

interface DataTableProps {
    grapher: Grapher
}

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

@observer
export class DataTable extends React.Component<DataTableProps> {
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
        dimIndex = Math.min(dimIndex, this.transform.dimensions.length - 1)
        if (dimIndex !== ENTITY_DIM_INDEX) {
            const availableColumns = this.transform.dimensionsWithValues[
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

    @computed private get entityType() {
        return this.grapher.entityType
    }

    @computed private get grapher() {
        return this.props.grapher
    }

    @computed private get transform() {
        return this.grapher.dataTableTransform
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

    @computed private get displayDimensions() {
        return this.transform.displayDimensions
    }

    @computed private get displayRows() {
        const { order } = this.tableState.sort
        return orderBy(this.transform.displayRows, this.sortValueMapper, [
            order,
        ])
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
            const dimensionHeaderText = (
                <React.Fragment>
                    <span className="name">{upperFirst(dim.name)}</span>
                    <span className="unit">{dim.unit}</span>
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

            return <ColumnHeader key={dim.key} {...props} />
        })
    }

    private get dimensionSubheaders() {
        const { sort } = this.tableState
        return this.displayDimensions.map((dim, dimIndex) =>
            dim.columns.map((column, i) => {
                const headerText =
                    column.targetTimeMode === TargetTimeMode.point
                        ? dim.formatTime(column.targetTime!)
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
                        subdimensionType={column.key}
                        lastSubdimension={i === dim.columns.length - 1}
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
        formatTime: (num: number, options?: { format?: string }) => string
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
                        formatTime(column.targetTime!),
                        formatTime(value.time!, {
                            format: "MMM D",
                        })
                    )}
                {value.formattedValue}
                {value.time !== undefined &&
                    column.targetTimeMode === TargetTimeMode.range && (
                        <span className="range-time">
                            {" "}
                            in{" "}
                            {formatTime(value.time!, {
                                format: "MMM D",
                            })}
                        </span>
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
                            dimension.formatTime
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

    render() {
        return (
            <table className="data-table">
                <thead>{this.headerRow}</thead>
                <tbody>{this.valueRows}</tbody>
            </table>
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
    dataType: "text" | "numeric"
    subdimensionType?: ColumnKey
    lastSubdimension?: boolean
}) {
    const {
        sortable,
        sortedCol,
        colType,
        subdimensionType,
        lastSubdimension,
    } = props
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
                    deltaColumn:
                        subdimensionType === "delta" ||
                        subdimensionType === "deltaRatio",
                })}
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
            </div>
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
