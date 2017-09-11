import * as React from 'react'
import {observable, computed, asFlat, action, spy} from 'mobx'
import {observer} from 'mobx-react'
import Bounds from './Bounds'
import {bind} from 'decko'
import ChartConfig from './ChartConfig'
import Text from './Text'
import LabelledSlopes, {SlopeChartSeries} from './LabelledSlopes'
import {DimensionWithData} from './ChartData'
import NoData from './NoData'

@observer
export default class SlopeChart extends React.Component<{ bounds: Bounds, chart: ChartConfig }> {
	@computed get transform() {
		return this.props.chart.slopeChart
	}

	render() {
        if (this.transform.failMessage)
            return <NoData bounds={this.props.bounds} message={this.transform.failMessage}/>

		const {bounds, chart} = this.props
		const {yAxis} = chart
		const {data} = this.transform

		return <LabelledSlopes bounds={bounds} yDomain={yAxis.domain} yTickFormat={yAxis.tickFormat} yScaleType={yAxis.scaleType} yScaleTypeOptions={yAxis.scaleTypeOptions} onScaleTypeChange={(scaleType) => { chart.yAxis.scaleType = scaleType }} data={data}/>
	}
}
