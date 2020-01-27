import * as React from "react"
import { computed, observable } from "mobx"
import { observer } from "mobx-react"

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faInfoCircle } from "@fortawesome/free-solid-svg-icons/faInfoCircle"

import { ChartConfig } from "./ChartConfig"
import { capitalize, some, defaultTo } from "./Util"
import {
    DataTableTransform,
    DataTableRow,
    DimensionColumn,
    TargetYearModes,
    SortOrder,
    SortOrders,
    ColumnType
} from "./DataTableTransform"
import { Tippy } from "./Tippy"

interface DataTableProps {
    chart: ChartConfig
}

interface DataTableState {
    sort?: DataTableSortState
}

interface DataTableSortState {
    dimension: "entity" | number // 'entity' or dimension index
    column: ColumnType | undefined // the name or index of nested column?
    order: SortOrder
}

const DEFAULT_SORT_STATE: DataTableSortState = {
    dimension: "entity",
    column: undefined,
    order: SortOrders.asc
}

@observer
export class DataTable extends React.Component<DataTableProps> {
    @observable storedState: DataTableState = {}

    @computed get state(): DataTableState {
        return {
            sort: this.sortState
        }
    }

    @computed get sortState(): DataTableSortState {
        let dimension = defaultTo(
            this.state.sort?.dimension,
            DEFAULT_SORT_STATE.dimension
        )
        let column = defaultTo(
            this.state.sort?.column,
            DEFAULT_SORT_STATE.column
        )
        const order = defaultTo(
            this.state.sort?.order,
            DEFAULT_SORT_STATE.order
        )

        if (typeof dimension === "number") {
            dimension = Math.min(
                dimension,
                this.transform.displayDimensions.length - 1
            )

            const availableColumns = this.transform.displayDimensions[
                dimension
            ].columns
                .filter(sub => sub.sortable)
                .map(sub => sub.type)

            if (column === undefined || !availableColumns.includes(column)) {
                column = availableColumns[0]
            }
        }

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
        return new DataTableTransform(this.props.chart)
    }

    @computed get hasSubheaders() {
        return some(
            this.transform.displayDimensions,
            header => header.columns.length > 1
        )
    }

    // @action onSort({}: {})

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
                        {this.transform.displayDimensions.map(dh =>
                            dh.columns.map((sh, index) => (
                                <th key={index}>
                                    {sh.targetYearMode === TargetYearModes.point
                                        ? sh.targetYear
                                        : sh.type}
                                </th>
                            ))
                        )}
                    </tr>
                )}
            </React.Fragment>
        )
    }

    renderEntityRow(row: DataTableRow, columns: DimensionColumn[]) {
        return (
            <tr key={row.entity}>
                <td key="entity" className="entity">
                    {row.entity}
                </td>
                {row.values.map((dv, index) => {
                    const column = columns[index]
                    return (
                        <td key={dv.key} className="dimension">
                            {dv.year !== undefined &&
                                column.targetYearMode ===
                                    TargetYearModes.point &&
                                column.targetYear !== undefined &&
                                column.targetYear !== dv.year && (
                                    <ClosestYearNotice
                                        year={dv.year}
                                        targetYear={column.targetYear}
                                    />
                                )}
                            {dv.formattedValue}
                            {dv.year !== undefined &&
                                column.targetYearMode ===
                                    TargetYearModes.range && (
                                    <span className="notice">
                                        {" "}
                                        in {dv.year}
                                    </span>
                                )}
                        </td>
                    )
                })}
            </tr>
        )
    }

    renderRows() {
        return this.transform.displayRows.map(row =>
            this.renderEntityRow(row, this.transform.displayColumns)
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
