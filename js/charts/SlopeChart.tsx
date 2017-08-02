import * as _ from 'lodash'
import * as d3 from 'd3'
import * as React from 'react'
import {observable, computed, asFlat, action, spy} from 'mobx'
import {observer} from 'mobx-react'
import Bounds from './Bounds'
import {bind} from 'decko'
import {getRelativeMouse} from './Util'
import ChartConfig from './ChartConfig'
import Text from './Text'
import LabelledSlopes, {SlopeChartSeries} from './LabelledSlopes'
import {DimensionWithData} from './ChartData'

@observer
export default class SlopeChart extends React.Component<{ bounds: Bounds, chart: ChartConfig }> {
	@computed get transform() {
		return this.props.chart.slopeChart
	}

	render() {
		const {bounds, chart} = this.props
		const {yAxis} = chart
		const {data} = this.transform

		return <LabelledSlopes bounds={bounds} yDomain={yAxis.domain} yTickFormat={yAxis.tickFormat} yScaleType={yAxis.scaleType} yScaleTypeOptions={yAxis.scaleTypeOptions} onScaleTypeChange={(scaleType) => { chart.yAxis.scaleType = scaleType }} data={data}/>
	}
}
