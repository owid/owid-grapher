import React from "react"
import { observer } from "mobx-react"
import { Bounds } from "charts/utils/Bounds"
import { ChartConfig } from "charts/core/ChartConfig"
import { computed } from "mobx"
import { LineChart } from "charts/lineCharts/LineChart"

@observer
export class FacetChart extends React.Component<{
    bounds: Bounds
    number: number
    chart: ChartConfig
}> {
    @computed get smallCharts() {
        const { chart, bounds } = this.props
        const charts = bounds.split(this.props.number || 1)
        return charts.map((bounds: Bounds, index: number) => (
            <LineChart key={index} bounds={bounds} options={chart} />
        ))
    }

    render() {
        return this.smallCharts
    }
}
