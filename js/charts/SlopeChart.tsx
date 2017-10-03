import * as React from 'react'
import { computed } from 'mobx'
import { observer } from 'mobx-react'
import Bounds from './Bounds'
import ChartConfig from './ChartConfig'
import LabelledSlopes from './LabelledSlopes'
import NoData from './NoData'

@observer
export default class SlopeChart extends React.Component<{ bounds: Bounds, chart: ChartConfig }> {
    @computed get transform() {
        return this.props.chart.slopeChart
    }

    render() {
        if (this.transform.failMessage)
            return <NoData bounds={this.props.bounds} message={this.transform.failMessage} />

        const { bounds, chart } = this.props
        const { yAxis } = chart
        const { data } = this.transform

        return <LabelledSlopes bounds={bounds} yDomain={yAxis.domain} yTickFormat={this.transform.yTickFormat} yScaleType={yAxis.scaleType} yScaleTypeOptions={yAxis.scaleTypeOptions} onScaleTypeChange={(scaleType) => { chart.yAxis.scaleType = scaleType }} data={data} />
    }
}
