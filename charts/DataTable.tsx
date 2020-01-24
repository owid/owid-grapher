import * as React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"

import { ChartConfig } from "./ChartConfig"
import { capitalize } from "./Util"
import { DataTableTransform, DataTableRow } from "./DataTableTransform"

interface DataTableProps {
    chart: ChartConfig
}

@observer
export class DataTable extends React.Component<DataTableProps> {
    @computed get entityType() {
        return this.props.chart.entityType
    }

    @computed get transform() {
        return new DataTableTransform(this.props.chart)
    }

    renderHeaderRow() {
        return (
            <tr>
                <th key="entity" className="entity">
                    {capitalize(this.entityType)}
                </th>
                {this.transform.dimensionHeaders.map(dh => (
                    <th key={dh.key} className="dimension" colSpan={dh.colSpan}>
                        <span className="name">{dh.name}</span>
                        <span className="unit">{dh.unit}</span>
                    </th>
                ))}
            </tr>
        )
    }

    renderEntityRow(row: DataTableRow) {
        return (
            <tr key={row.entity}>
                <td key="entity" className="entity">
                    {row.entity}
                </td>
                {row.dimensionValues.map(dv => (
                    <td key={dv.key} className="dimension">
                        {dv.year !== undefined &&
                            dv.targetYear !== dv.year &&
                            `(${dv.year}) `}
                        {dv.formattedValue}
                    </td>
                ))}
            </tr>
        )
    }

    renderRows() {
        return this.transform.displayRows.map(row => this.renderEntityRow(row))
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
