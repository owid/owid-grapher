import React from "react"
import { observer } from "mobx-react"
import { Bounds } from "charts/utils/Bounds"
import { Grapher } from "charts/core/Grapher"
import { computed } from "mobx"
import { ChartTypeMap, ChartTypeName } from "charts/chart/ChartTypes"

interface FacetChartProps {
    width: number
    height: number
    number: number
    padding: number
    chartTypeName: ChartTypeName
    chart: Grapher
}

@observer
export class FacetChart extends React.Component<FacetChartProps> {
    @computed get smallCharts() {
        const { chart, chartTypeName } = this.props
        const charts = this.bounds.split(
            this.props.number || 1,
            this.props.padding
        )
        const ChartType = ChartTypeMap[chartTypeName] as any

        return charts.map((bounds: Bounds, index: number) => (
            <ChartType key={index} bounds={bounds} chart={chart} />
        ))
    }

    @computed get bounds() {
        const { width, height } = this.props
        return new Bounds(0, 0, width, height)
    }

    render() {
        const { width, height } = this.props
        return (
            <svg width={width} height={height}>
                {this.smallCharts}
            </svg>
        )
    }
}
