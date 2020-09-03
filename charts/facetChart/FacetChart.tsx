import React from "react"
import { observer } from "mobx-react"
import { Bounds } from "charts/utils/Bounds"
import { ChartConfig } from "charts/core/ChartConfig"
import { computed } from "mobx"
import { ChartTypeMap, ChartTypeName } from "charts/core/ChartTypes"

@observer
export class FacetChart extends React.Component<{
    bounds: Bounds
    number: number
    chartTypeName: ChartTypeName
    chart: ChartConfig
}> {
    @computed get smallCharts() {
        const { chart, bounds, chartTypeName } = this.props
        const charts = bounds.split(this.props.number || 1)
        const ChartType = ChartTypeMap[chartTypeName] as any

        return charts.map((bounds: Bounds, index: number) => (
            <ChartType key={index} bounds={bounds} chart={chart} />
        ))
    }

    render() {
        return this.smallCharts
    }
}
