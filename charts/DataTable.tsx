import * as React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faInfoCircle } from "@fortawesome/free-solid-svg-icons/faInfoCircle"

import { ChartConfig } from "./ChartConfig"
import { capitalize, some } from "./Util"
import {
    DataTableTransform,
    DataTableRow,
    DataTableColumn,
    TargetYearModes
} from "./DataTableTransform"
import { Tippy } from "./Tippy"

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

    @computed get hasSubheaders() {
        return some(
            this.transform.dimensionHeaders,
            header => header.subheaders.length > 1
        )
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
                    {this.transform.dimensionHeaders.map(dh => (
                        <th
                            key={dh.key}
                            className="dimension"
                            colSpan={dh.subheaders.length}
                        >
                            <span className="name">{dh.name}</span>
                            <span className="unit">{dh.unit}</span>
                        </th>
                    ))}
                </tr>
                {this.hasSubheaders && (
                    <tr>
                        {this.transform.dimensionHeaders.map(dh =>
                            dh.subheaders.map((sh, index) => (
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

    renderEntityRow(row: DataTableRow, columns: DataTableColumn[]) {
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
