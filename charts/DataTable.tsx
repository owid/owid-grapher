import * as React from "react"
import { computed, observable, action } from "mobx"
import { observer } from "mobx-react"

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faInfoCircle } from "@fortawesome/free-solid-svg-icons/faInfoCircle"

import { ChartConfig } from "./ChartConfig"
import { capitalize, some, defaultTo } from "./Util"
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
import { Tippy } from "./Tippy"

export interface DataTableProps {
    chart: ChartConfig
}

export interface DataTableState {
    sort: DataTableSortState
}

interface DataTableSortState {
    dimension: "entity" | number // 'entity' or dimension index
    column: ColumnKey | undefined
    order: SortOrder
}

const DEFAULT_SORT_STATE: DataTableSortState = {
    dimension: "entity",
    column: undefined,
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
        const column = defaultTo(
            this.storedState.sort.column,
            DEFAULT_SORT_STATE.column
        )
        const order = defaultTo(
            this.storedState.sort.order,
            DEFAULT_SORT_STATE.order
        )

        // if (typeof dimension === "number") {
        //     dimension = Math.min(
        //         dimension,
        //         this.transform.displayDimensions.length - 1
        //     )

        //     const availableColumns = this.transform.displayDimensions[
        //         dimension
        //     ].columns
        //         .filter(sub => sub.sortable)
        //         .map(sub => sub.type)

        //     if (column === undefined || !availableColumns.includes(column)) {
        //         column = availableColumns[0]
        //     }
        // }

        return {
            dimension,
            column,
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

    @action.bound onSort(dimIndex: number, column: ColumnKey) {
        const order =
            this.tableState.sort.dimension === dimIndex &&
            this.tableState.sort.column === column
                ? toggleSortOrder(this.tableState.sort.order)
                : SortOrders.asc

        this.storedState.sort.dimension = dimIndex
        this.storedState.sort.column = column
        this.storedState.sort.order = order
    }

    renderHeaderRow() {
        return (
            <React.Fragment>
                <tr>
                    <th
                        key="entity"
                        className="entity"
                        rowSpan={this.hasSubheaders ? 2 : 1}
                    >
                        {capitalize(this.entityType)}
                    </th>
                    {this.transform.displayDimensions.map(dh => (
                        <th
                            key={dh.key}
                            className="dimension"
                            colSpan={dh.columns.length}
                        >
                            <span className="name">{dh.name}</span>
                            <span className="unit">{dh.unit}</span>
                        </th>
                    ))}
                </tr>
                {this.hasSubheaders && (
                    <tr>
                        {this.transform.displayDimensions.map((dim, dimIndex) =>
                            dim.columns.map((sh, index) => (
                                <th
                                    key={index}
                                    onClick={() =>
                                        this.onSort(dimIndex, sh.type)
                                    }
                                >
                                    {sh.targetYearMode === TargetYearModes.point
                                        ? sh.targetYear
                                        : columnNameByType[sh.type]}
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
            <td key={key} className="dimension">
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
                <td key="entity" className="entity">
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
