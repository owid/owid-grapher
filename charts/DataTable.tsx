import { computed } from "mobx"
import { observer } from "mobx-react"
import * as React from "react"

import { ChartConfig } from "./ChartConfig"
import { DataTableRow, DataTableTransform } from "./DataTableTransform"
import { capitalize } from "./Util"

interface DataTableProps {
    chart: ChartConfig
}

@observer
export class DataTable extends React.Component<DataTableProps> {
    @computed get entityType() {
        return this.props.chart.entityType
    }

    @computed get data() {
        return this.props.chart.data
    }

    @computed get transform() {
        return new DataTableTransform(this.data)
    }

    renderHeaderRow() {
        return (
            <tr>
                <th key="entity" className="entity">
                    {capitalize(this.entityType)}
                </th>
                {this.transform.dimensionHeaders.map(dh => (
                    <th key={dh.key} className="dimension">
                        {dh.name}
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
