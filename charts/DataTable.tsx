import * as React from "react"
import { computed, observable, action } from "mobx"
import { observer } from "mobx-react"
import classnames from "classnames"

import { IconDefinition } from "@fortawesome/fontawesome-svg-core"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faInfoCircle } from "@fortawesome/free-solid-svg-icons/faInfoCircle"
import { faSortAmountDownAlt } from "@fortawesome/free-solid-svg-icons/faSortAmountDownAlt"
import { faSortAmountUp } from "@fortawesome/free-solid-svg-icons/faSortAmountUp"
import { faSortAlphaDown } from "@fortawesome/free-solid-svg-icons/faSortAlphaDown"
import { faSortAlphaUpAlt } from "@fortawesome/free-solid-svg-icons/faSortAlphaUpAlt"

import { ChartConfig } from "./ChartConfig"
import { capitalize, some, defaultTo, orderBy } from "./Util"
import { Tippy } from "./Tippy"
import {
    DataTableTransform,
    DataTableRow,
    TargetYearMode,
    SortOrder,
    ColumnKey,
    isSingleValue,
    DataTableDimension,
    DataTableColumn,
    DimensionValue,
    isRangeValue,
    RangeValueKey,
    SingleValueKey,
    Value
} from "./DataTableTransform"

export interface DataTableProps {
    chart: ChartConfig
}

export interface DataTableState {
    sort: DataTableSortState
}

const ENTITY_DIM_INDEX = -1

export type DimensionIndex = number

export interface DataTableSortState {
    dimIndex: DimensionIndex
    columnKey: ColumnKey | undefined
    order: SortOrder
}

const DEFAULT_SORT_STATE: DataTableSortState = {
    dimIndex: ENTITY_DIM_INDEX,
    columnKey: undefined,
    order: SortOrder.asc
}

const columnNameByType: Record<ColumnKey, string> = {
    single: "Value",
    start: "Start",
    end: "End",
    delta: "Change",
    deltaRatio: "Change (%)"
}

function inverseSortOrder(order: SortOrder): SortOrder {
    return order === SortOrder.asc ? SortOrder.desc : SortOrder.asc
}

@observer
export class DataTable extends React.Component<DataTableProps> {
    @observable private storedState: DataTableState = {
        sort: DEFAULT_SORT_STATE
    }

    @computed get tableState(): DataTableState {
        return {
            sort: this.sortState
        }
    }

    @computed get sortState(): DataTableSortState {
        let { dimIndex, columnKey, order } = {
            ...DEFAULT_SORT_STATE,
            ...this.storedState.sort
        }

        // If not sorted by entity, then make sure the index of the chosen column exists
        if (dimIndex !== ENTITY_DIM_INDEX) {
            dimIndex = Math.min(dimIndex, this.transform.dimensions.length - 1)
            const availableColumns = this.transform.dimensionsWithValues[
                dimIndex
            ].columns.map(sub => sub.key)
            if (
                columnKey === undefined ||
                !availableColumns.includes(columnKey)
            ) {
                columnKey = availableColumns[0]
            }
        }

        return {
            dimIndex,
            columnKey,
            order
        }
    }

    @computed get entityType() {
        return this.props.chart.entityType
    }

    @computed get transform() {
        return new DataTableTransform(this.props.chart)
    }

    @computed get sortValueMapper(): (
        row: DataTableRow
    ) => number | string | undefined {
        const { dimIndex, columnKey, order } = this.tableState.sort

        if (dimIndex === ENTITY_DIM_INDEX) {
            return row => row.entity
        }

        return row => {
            const dv = row.dimensionValues[dimIndex] as DimensionValue

            let value: number | string | undefined

            if (isSingleValue(dv)) {
                value = dv.single?.value
            } else if (
                isRangeValue(dv) &&
                columnKey !== undefined &&
                columnKey in RangeValueKey
            ) {
                value = dv[columnKey as RangeValueKey]?.value
            }

            // We always want undefined values to be last
            if (
                value === undefined ||
                (typeof value === "number" &&
                    (!isFinite(value) || isNaN(value)))
            ) {
                return order === SortOrder.asc ? Infinity : -Infinity
            }

            return value
        }
    }

    @computed get displayDimensions() {
        return this.transform.displayDimensions
    }

    @computed get displayRows() {
        const { order } = this.tableState.sort
        return orderBy(this.transform.displayRows, this.sortValueMapper, [
            order
        ])
    }

    @computed get hasSubheaders() {
        return some(this.displayDimensions, header => header.columns.length > 1)
    }

    @action.bound onSort(dimIndex: DimensionIndex, columnKey?: ColumnKey) {
        const { sort } = this.tableState
        const order =
            sort.dimIndex === dimIndex && sort.columnKey === columnKey
                ? inverseSortOrder(sort.order)
                : SortOrder.asc

        this.storedState.sort.dimIndex = dimIndex
        this.storedState.sort.columnKey = columnKey
        this.storedState.sort.order = order
    }

    renderSortIcon(params: { type?: "text" | "numeric"; isActive?: boolean }) {
        const type = defaultTo(params.type, "numeric")
        const isActive = defaultTo(params.isActive, false)

        const order = isActive
            ? this.tableState.sort.order
            : DEFAULT_SORT_STATE.order

        let faIcon: IconDefinition

        if (type === "text") {
            faIcon =
                order === SortOrder.desc ? faSortAlphaUpAlt : faSortAlphaDown
        } else {
            faIcon =
                order === SortOrder.desc ? faSortAmountUp : faSortAmountDownAlt
        }

        return (
            <span
                className={classnames({ "sort-icon": true, active: isActive })}
            >
                <FontAwesomeIcon icon={faIcon} />
            </span>
        )
    }

    renderHeaderRow() {
        const { sort } = this.tableState
        return (
            <React.Fragment>
                <tr>
                    <th
                        key="entity"
                        className={classnames({
                            entity: true,
                            sortable: true,
                            sorted: sort.dimIndex === ENTITY_DIM_INDEX
                        })}
                        rowSpan={this.hasSubheaders ? 2 : 1}
                        onClick={() => this.onSort(ENTITY_DIM_INDEX)}
                    >
                        {capitalize(this.entityType)}
                        {this.renderSortIcon({
                            type: "text",
                            isActive: sort.dimIndex === ENTITY_DIM_INDEX
                        })}
                    </th>
                    {this.displayDimensions.map((dim, dimIndex) => (
                        <th
                            key={dim.key}
                            className={classnames({
                                dimension: true,
                                sortable: dim.sortable,
                                sorted:
                                    dim.sortable && sort.dimIndex === dimIndex
                            })}
                            rowSpan={
                                this.hasSubheaders && dim.columns.length < 2
                                    ? 2
                                    : 1
                            }
                            colSpan={dim.columns.length}
                            onClick={() =>
                                dim.sortable &&
                                this.onSort(dimIndex, SingleValueKey.single)
                            }
                        >
                            <span className="name">{dim.name}</span>
                            <span className="unit">{dim.unit}</span>
                            {dim.sortable &&
                                this.renderSortIcon({
                                    isActive: sort.dimIndex === dimIndex
                                })}
                        </th>
                    ))}
                </tr>
                {this.hasSubheaders && (
                    <tr>
                        {this.displayDimensions.map((dim, dimIndex) =>
                            dim.columns.map((column, index) => {
                                const isSorted =
                                    sort.dimIndex === dimIndex &&
                                    sort.columnKey === column.key
                                return (
                                    <th
                                        key={index}
                                        className={classnames({
                                            sortable: column.sortable,
                                            sorted: isSorted
                                        })}
                                        onClick={() =>
                                            this.onSort(dimIndex, column.key)
                                        }
                                    >
                                        {column.targetYearMode ===
                                        TargetYearMode.point
                                            ? column.targetYear
                                            : columnNameByType[column.key]}
                                        {this.renderSortIcon({
                                            isActive: isSorted
                                        })}
                                    </th>
                                )
                            })
                        )}
                    </tr>
                )}
            </React.Fragment>
        )
    }

    renderValueCell(
        key: string,
        column: DataTableColumn,
        dv: DimensionValue | undefined,
        sorted: boolean
    ) {
        let value: Value | undefined

        if (dv !== undefined && isSingleValue(dv) && column.key in dv) {
            value = dv[column.key as SingleValueKey] as Value
        } else if (dv !== undefined && isRangeValue(dv) && column.key in dv) {
            value = dv[column.key as RangeValueKey] as Value
        }

        if (value === undefined) {
            return <td key={key} className="dimension" />
        }

        return (
            <td
                key={key}
                className={classnames([
                    "dimension",
                    `dimension-${column.key}`,
                    {
                        sorted: sorted
                    }
                ])}
            >
                {value.year !== undefined &&
                    column.targetYearMode === TargetYearMode.point &&
                    column.targetYear !== undefined &&
                    column.targetYear !== value.year && (
                        <ClosestYearNotice
                            year={value.year}
                            targetYear={column.targetYear}
                        />
                    )}
                {value.formattedValue}
                {value.year !== undefined &&
                    column.targetYearMode === TargetYearMode.range && (
                        <span className="range-year"> in {value.year}</span>
                    )}
            </td>
        )
    }

    renderEntityRow(row: DataTableRow, dimensions: DataTableDimension[]) {
        const { sort } = this.tableState
        return (
            <tr key={row.entity}>
                <td
                    key="entity"
                    className={classnames({
                        entity: true,
                        sorted: sort.dimIndex === ENTITY_DIM_INDEX
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
                                sort.columnKey === column.key
                        )
                    })
                })}
            </tr>
        )
    }

    renderRows() {
        return this.displayRows.map(row =>
            this.renderEntityRow(row, this.displayDimensions)
        )
    }

    render() {
        return (
            <table className="data-table">
                <thead>{this.renderHeaderRow()}</thead>
                <tbody>{this.renderRows()}</tbody>
            </table>
        )
    }
}

export const ClosestYearNotice = ({
    targetYear,
    year
}: {
    targetYear: number
    year: number
}) => (
    <Tippy
        content={
            <div className="closest-year-notice">
                <strong>Data not available for {targetYear}</strong>
                <br />
                Showing closest available year ({year})
            </div>
        }
        arrow={false}
    >
        <span className="notice">
            in {year}{" "}
            <span className="icon">
                <FontAwesomeIcon icon={faInfoCircle} />
            </span>
        </span>
    </Tippy>
)
