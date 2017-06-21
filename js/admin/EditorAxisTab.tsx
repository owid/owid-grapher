import * as React from 'react'
import {computed, action} from 'mobx'
import {observer} from 'mobx-react'
import ChartConfig from '../charts/ChartConfig'
import {AxisConfigProps} from '../charts/AxisConfig'
import {numberOrNull} from '../charts/Util'
import {toString} from 'lodash'
import {TextField, NumberField, SelectField, Toggle} from './Forms'

@observer
export default class EditorAxisTab extends React.Component<{ chart: ChartConfig }, undefined> {
	@computed get xAxis() { return this.props.chart.xAxis.props }
	@computed get yAxis() { return this.props.chart.yAxis.props }

	renderForAxis(axisName: string, axis: AxisConfigProps) {
		return <div>
			<h3>{axisName} Axis</h3>
			<TextField label={axisName+"-Axis Label"} value={axis.label} onValue={(value) => axis.label = value}/>
			<NumberField label={axisName+"-Axis Max"} value={axis.max} onValue={(value) => axis.max = value}/>
			<NumberField label={axisName+"-Axis Min"} value={axis.min} onValue={(value) => axis.min = value}/>
			<TextField label={axisName+"-Axis Prefix"} value={axis.prefix} onValue={(value) => axis.prefix = value}/>
			<TextField label={axisName+"-Axis Suffix"} value={axis.suffix} onValue={(value) => axis.suffix = value}/>
			<NumberField label={axisName+"-Axis No of decimal places"} value={axis.numDecimalPlaces} onValue={(value) => axis.numDecimalPlaces = value}/>
			<SelectField label={axisName+"-Axis Scale"} value={axis.scaleType} options={['linear', 'log']} onValue={(value) => axis.scaleType = value == 'linear' ? 'linear' : 'log'}/>
			{" "}<Toggle label={`User can select ${axisName} axis scale`} value={axis.canChangeScaleType} onValue={(value) => axis.canChangeScaleType = value}/>
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