import * as React from 'react'
import {computed, action} from 'mobx'
import {observer} from 'mobx-react'
import ChartEditor from './ChartEditor'
import {AxisConfigProps} from '../charts/AxisConfig'
import {toString} from 'lodash'
import {TextField, NumberField, SelectField, Toggle} from './Forms'
import ChartType from '../charts/ChartType'

@observer
export default class EditorCustomizeTab extends React.Component<{ editor: ChartEditor }> {
	@computed get xAxis() { return this.props.editor.chart.xAxis.props }
	@computed get yAxis() { return this.props.editor.chart.yAxis.props }

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
			{" "}<Toggle label={`User can select ${axisName} axis scale`} value={axis.canChangeScaleType||false} onValue={(value) => axis.canChangeScaleType = value||undefined}/>
		</div>
	}

	render() {
		const {xAxis, yAxis} = this
		const {features} = this.props.editor
		const {chart} = this.props.editor

		return <div className="tab-pane">
			{chart.type == ChartType.LineChart && <section className="type-of-line-section">
				<h2>Choose Type of Line</h2>
				<label>
					<input type="radio" name="line-type" value="0"/>
					Line with dots
				</label>
				<label>
					<input type="radio" name="line-type" value="1"/>
					Line without dots
				</label>
				<label>
					<input type="radio" name="line-type" value="3"/>
					Dotted with dashed line for missing observations
				</label>
				<br/>
				<label style={{display: "none"}}>
					Maximum year gap to tolerate
					<input type="input" className="form-control" name="line-tolerance" value=""/>
				</label>
			</section>}
			<section className="legend-section">
				<h2>Legend</h2>
				<label className="clickable">
					<input type="checkbox" name="hide-toggle" />
					Hide absolute/relative toggle
				</label>
			</section>
			<section>
				{features.customYAxis && this.renderForAxis('Y', yAxis)}
				{features.customXAxis && this.renderForAxis('X', xAxis)}
			</section>
		</div>
	}
}