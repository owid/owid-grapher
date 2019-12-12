import * as React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"

import { ChartConfig } from "./ChartConfig"
import { max, capitalize } from "./Util"
import { reduce } from "lodash-es"

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

    @computed get dimensions() {
        return this.data.filledDimensions
    }

    @computed get entities() {
        return this.data.availableEntities
    }

    @computed get yearByVariable() {
        return reduce(
            this.dimensions,
            (map, dim) => map.set(dim.variableId, max(dim.years)),
            new Map<number, number | undefined>()
        )
    }

    renderHeaderRow() {
        return (
            <tr>
                <th key="entity" className="entity">
                    {capitalize(this.entityType)}
                </th>
                {this.dimensions.map(dim => (
                    <th key={dim.variableId} className="dimension">
                        {dim.displayName}
                    </th>
                ))}
            </tr>
        )
    }

    renderEntityRow(entity: string) {
        return (
            <tr key={entity}>
                <td key="entity" className="entity">
                    {entity}
                </td>
                {this.dimensions.map(dim => {
                    const valueByYear = dim.valueByEntityAndYear.get(entity)
                    const year = this.yearByVariable.get(dim.variableId)
                    const value = valueByYear && year && valueByYear.get(year)
                    return (
                        <td key={dim.variableId} className="dimension">
                            {value && dim.formatValueLong(value)}
                        </td>
                    )
                })}
            </tr>
        )
    }

    renderRows() {
        return this.entities.map(entity => this.renderEntityRow(entity))
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
