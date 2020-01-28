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
import { capitalize, some, defaultTo } from "./Util"
import { Tippy } from "./Tippy"
import {
    DataTableTransform,
    DataTableRow,
    TargetYearModes,
    SortOrder,
    SortOrders,
    ColumnKey,
    isSingleValue,
    DataTableDimension,
    ColumnKeys,
    DataTableColumn,
    DimensionValue,
    isCompositeValue,
    SingleValue,
    CompositeValueKey
} from "./DataTableTransform"

export interface DataTableProps {
    chart: ChartConfig
}

export interface DataTableState {
    sort: DataTableSortState
}

// 'entity' or dimension index
type SortDimension = "entity" | number

interface DataTableSortState {
    dimension: SortDimension
    dimensionColumn: ColumnKey | undefined
    order: SortOrder
}

const DEFAULT_SORT_STATE: DataTableSortState = {
    dimension: "entity",
    dimensionColumn: undefined,
    order: SortOrders.asc
}

const columnNameByType: Record<ColumnKey, string> = {
    value: "Value",
    start: "Start",
    end: "End",
    delta: "Change",
    deltaRatio: "Change (%)"
}

function toggleSortOrder(order: SortOrder): SortOrder {
    return order === SortOrders.asc ? SortOrders.desc : SortOrders.asc
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
        const dimension = defaultTo(
            this.storedState.sort.dimension,
            DEFAULT_SORT_STATE.dimension
        )
        const dimensionColumn = defaultTo(
            this.storedState.sort.dimensionColumn,
            DEFAULT_SORT_STATE.dimensionColumn
        )
        const order = defaultTo(
            this.storedState.sort.order,
            DEFAULT_SORT_STATE.order
        )

        // TODO need to ensure config is valid
        if (typeof dimension === "number") {
            // dimension = Math.min(
            //     dimension,
            //     this.transform.dimensions.length - 1
            // )
            // const availableColumns = this.transform.dimensionsWithValues[
            //     dimension
            // ].columns.map(sub => sub.type)
            // if (column === undefined || !availableColumns.includes(column)) {
            //     column = availableColumns[0]
            // }
        }

        return {
            dimension,
            dimensionColumn,
            order
        }
    }

    @computed get entityType() {
        return this.props.chart.entityType
    }

    @computed get transform() {
        return new DataTableTransform(this.props.chart, this.tableState)
    }

    @computed get hasSubheaders() {
        return some(
            this.transform.displayDimensions,
            header => header.columns.length > 1
        )
    }

    @action.bound onSort(dimension: SortDimension, column?: ColumnKey) {
        const order =
            this.tableState.sort.dimension === dimension &&
            this.tableState.sort.dimensionColumn === column
                ? toggleSortOrder(this.tableState.sort.order)
                : SortOrders.asc

        this.storedState.sort.dimension = dimension
        this.storedState.sort.dimensionColumn = column
        this.storedState.sort.order = order
    }

    renderSortIcon(params: { type?: "text" | "numeric"; isActive?: boolean }) {
        const type = defaultTo(params.type, "numeric")
        const isActive = defaultTo(params.isActive, false)

        const order = isActive ? this.tableState.sort.order : SortOrders.asc

        let faIcon: IconDefinition

        if (type === "text") {
            faIcon =
                order === SortOrders.desc ? faSortAlphaUpAlt : faSortAlphaDown
        } else {
            faIcon =
                order === SortOrders.desc ? faSortAmountUp : faSortAmountDownAlt
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
        return (
            <React.Fragment>
                <tr>
                    <th
                        key="entity"
                        className={classnames({
                            entity: true,
                            sortable: true,
                            sorted: this.tableState.sort.dimension === "entity"
                        })}
                        rowSpan={this.hasSubheaders ? 2 : 1}
                        onClick={() => this.onSort("entity")}
                    >
                        {capitalize(this.entityType)}
                        {this.renderSortIcon({
                            type: "text",
                            isActive:
                                this.tableState.sort.dimension === "entity"
                        })}
                    </th>
                    {this.transform.displayDimensions.map((dim, dimIndex) => (
                        <th
                            key={dim.key}
                            className={classnames({
                                dimension: true,
                                sortable: dim.sortable,
                                sorted: dim.sorted
                            })}
                            rowSpan={
                                this.hasSubheaders && dim.columns.length < 2
                                    ? 2
                                    : 1
                            }
                            colSpan={dim.columns.length}
                            onClick={() =>
                                dim.sortable &&
                                this.onSort(dimIndex, ColumnKeys.value)
                            }
                        >
                            <span className="name">{dim.name}</span>
                            <span className="unit">{dim.unit}</span>
                            {dim.sortable &&
                                this.renderSortIcon({
                                    isActive:
                                        this.tableState.sort.dimension ===
                                        dimIndex
                                })}
                        </th>
                    ))}
                </tr>
                {this.hasSubheaders && (
                    <tr>
                        {this.transform.displayDimensions.map((dim, dimIndex) =>
                            dim.columns.map((column, index) => (
                                <th
                                    key={index}
                                    className={classnames({
                                        sortable: column.sortable,
                                        sorted: column.sorted !== undefined
                                    })}
                                    onClick={() =>
                                        this.onSort(dimIndex, column.type)
                                    }
                                >
                                    {column.targetYearMode ===
                                    TargetYearModes.point
                                        ? column.targetYear
                                        : columnNameByType[column.type]}
                                    {this.renderSortIcon({
                                        isActive: column.sorted !== undefined
                                    })}
                                </th>
                            ))
                        )}
                    </tr>
                )}
            </React.Fragment>
        )
    }

    renderValueCell(
        key: string,
        column: DataTableColumn,
        dv: DimensionValue | undefined
    ) {
        let value: SingleValue | undefined

        if (
            dv !== undefined &&
            isSingleValue(dv) &&
            column.type === ColumnKeys.value
        ) {
            value = dv
        } else if (
            dv !== undefined &&
            isCompositeValue(dv) &&
            column.type in dv
        ) {
            value = dv[column.type as CompositeValueKey] as SingleValue
        }

        if (value === undefined) {
            return <td key={key} className="dimension" />
        }

        return (
            <td
                key={key}
                className={classnames({
                    dimension: true,
                    sorted: column.sorted
                })}
            >
                {value.year !== undefined &&
                    column.targetYearMode === TargetYearModes.point &&
                    column.targetYear !== undefined &&
                    column.targetYear !== value.year && (
                        <ClosestYearNotice
                            year={value.year}
                            targetYear={column.targetYear}
                        />
                    )}
                {value.formattedValue}
                {value.year !== undefined &&
                    column.targetYearMode === TargetYearModes.range && (
                        <span className="range-year"> in {value.year}</span>
                    )}
            </td>
        )
    }

    renderEntityRow(row: DataTableRow, dimensions: DataTableDimension[]) {
        return (
            <tr key={row.entity}>
                <td
                    key="entity"
                    className={classnames({
                        entity: true,
                        sorted: this.tableState.sort.dimension === "entity"
                    })}
                >
                    {row.entity}
                </td>
                {row.dimensionValues.map((dv, dimIndex) => {
                    const dimension = dimensions[dimIndex]
                    return dimension.columns.map((column, colIndex) => {
                        const key = `${dimIndex}-${colIndex}`
                        return this.renderValueCell(key, column, dv)
                    })
                })}
            </tr>
        )
    }

    renderRows() {
        return this.transform.displayRows.map(row =>
            this.renderEntityRow(row, this.transform.displayDimensions)
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

const ClosestYearNotice = ({
    targetYear,
    year
}: {
    targetYear?: number
    year?: number
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
