import * as _ from 'lodash'
import * as React from 'react'
import {computed, action} from 'mobx'
import {observer} from 'mobx-react'
import ChartConfig from '../charts/ChartConfig'
import AxisConfig from '../charts/AxisConfig'
import {numberOrNull} from '../charts/Util'

@observer
export default class EditorAxisTab extends React.Component<{ chart: ChartConfig }, undefined> {
	@computed get xAxis() { return this.props.chart.xAxis }
	@computed get yAxis() { return this.props.chart.yAxis }

	renderForAxis(axisName: string, axis: AxisConfig) {
		return <div>
			<h3>{axisName} Axis</h3>
				<label>
					{axisName}-Axis Label
					<input className="form-control" type="text" value={axis.label} onChange={(ev) => axis.label = ev.target.value}/>
				</label>
				<label>
					{axisName}-Axis Max
					<input className="form-control" type="number" value={axis.domain[1]||""} onChange={(ev) => axis.domain[1] = numberOrNull(ev.target.value)}/>
				</label>
				<label>
					{axisName}-Axis Min
					<input className="form-control" type="number" value={axis.domain[0]||""} onChange={(ev) => axis.domain[0] = numberOrNull(ev.target.value)}/>
				</label>
				<label>
					{axisName}-Axis Prefix
					<input className="form-control" type="text" value={axis.prefix} onChange={(ev) => axis.prefix = ev.target.value}/>
				</label>
				<label>
					{axisName}-Axis Suffix
					<input className="form-control" type="text" value={axis.suffix} onChange={(ev) => axis.suffix = ev.target.value}/>
				</label>
				<label>
					{axisName}-Axis No of decimal places
					<input className="form-control" type="number" value={axis.numDecimalPlaces||""} onChange={(ev) => axis.numDecimalPlaces = numberOrNull(ev.target.value)}/>
				</label>
				<label>
					{axisName}-Axis Scale
					<select className="form-control" type="text" value={axis.scaleType} onChange={(ev) => axis.scaleType = ev.target.value == 'linear' ? 'linear' : 'log'}>
						<option value="linear">Linear</option>
						<option value="log">Log</option>
					</select>
				</label>
				<div className="input-wrapper axis-scale-selector-wrapper">
					<label>
						<input type="checkbox" checked={axis.canChangeScaleType} onChange={(ev) => axis.canChangeScaleType = ev.target.checked}/>
						User can select {axisName} axis scale
					</label>
				</div>
		</div>
	}

	render() {
		const {xAxis, yAxis} = this

		return <div id="axis-tab" className="tab-pane">
			<section>
				<h2>Refine your axis</h2>
				{this.renderForAxis('Y', yAxis)}
				{this.renderForAxis('X', xAxis)}
			</section>
		</div>
	}
}