import * as React from 'react'
import {computed, action} from 'mobx'
import {observer} from 'mobx-react'
import ChartEditor from './ChartEditor'
import ChartConfig from '../charts/ChartConfig'
import {AxisConfigProps} from '../charts/AxisConfig'
import {TextField, NumberField, SelectField, Toggle} from './Forms'
import ColorSchemes from '../charts/ColorSchemes'

@observer
class ColorSchemeSelector extends React.Component<{ chart: ChartConfig }> {
	@action.bound onValue(value: string) {
		this.props.chart.props.baseColorScheme = value == 'default' ? undefined : value
	}

	render() {
		const {chart} = this.props

		const availableColorSchemes = Object.keys(ColorSchemes)
		const colorSchemeLabels = availableColorSchemes.map(scheme => ColorSchemes[scheme].name)

		return <section>
			<h3>Colors</h3>
			<SelectField label="Color scheme" value={chart.baseColorScheme||"default"} onValue={this.onValue} options={["default"].concat(availableColorSchemes)} optionLabels={["Default"].concat(colorSchemeLabels)}/>
		</section>
	}
}

@observer
export default class EditorCustomizeTab extends React.Component<{ editor: ChartEditor }> {
	@computed get xAxis() { return this.props.editor.chart.xAxis.props }
	@computed get yAxis() { return this.props.editor.chart.yAxis.props }

	renderForAxis(axisName: string, axis: AxisConfigProps) {
		const {features} = this.props.editor

		return <div>
			<h3>{axisName} Axis</h3>
			{/*<TextField label={"Label"} value={axis.label} onValue={(value) => axis.label = value}/><br/>*/}
			{features.axisMinMax && <NumberField label={"Max"} value={axis.max} onValue={(value) => axis.max = value}/>}<br/>
			{features.axisMinMax && <NumberField label={"Min"} value={axis.min} onValue={(value) => axis.min = value}/>}<br/>
			{/*<TextField label={axisName+"-Axis Prefix"} value={axis.prefix} onValue={(value) => axis.prefix = value}/>
			<TextField label={axisName+"-Axis Suffix"} value={axis.suffix} onValue={(value) => axis.suffix = value}/>
			<NumberField label={axisName+"-Axis No of decimal places"} value={axis.numDecimalPlaces} onValue={(value) => axis.numDecimalPlaces = value}/>
			<SelectField label={axisName+"-Axis Scale"} value={axis.scaleType} options={['linear', 'log']} onValue={(value) => axis.scaleType = value == 'linear' ? 'linear' : 'log'}/>*/}
			{" "}{features.linLogToggle && <Toggle label={`Enable log/linear selector`} value={axis.canChangeScaleType||false} onValue={(value) => axis.canChangeScaleType = value||undefined}/>}
		</div>
	}

	render() {
		const {xAxis, yAxis} = this
		const {features} = this.props.editor
		const {chart} = this.props.editor

		return <div className="tab-pane">
			<ColorSchemeSelector chart={chart}/>

			{chart.isLineChart && false && <section className="type-of-line-section">
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
			<section>
				{features.customYAxis && this.renderForAxis(chart.isDiscreteBar ? 'X' : 'Y', yAxis)}
				{features.customXAxis && this.renderForAxis('X', xAxis)}
			</section>
			{(features.hideLegend || features.relativeModeToggle) && <section className="legend-section">
				<h2>Legend</h2>
				{features.hideLegend && <Toggle label={`Hide legend`} value={!!chart.hideLegend} onValue={(value) => chart.props.hideLegend = value||undefined}/>}
				{features.relativeModeToggle && <Toggle label={`Hide relative toggle`} value={!!chart.props.hideRelativeToggle} onValue={value => chart.props.hideRelativeToggle = value||undefined}/>}
				{features.entityType && <TextField label={`Entity name`} placeholder="country" value={chart.props.entityType} onValue={value => chart.props.entityType = value||undefined}/>}
			</section>}
		</div>
	}
}