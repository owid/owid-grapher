import * as _ from 'lodash'
import * as React from 'react'
import {computed, action} from 'mobx'
import {observer} from 'mobx-react'
import ChartConfig from '../charts/ChartConfig'

@observer
export default class EditorAxisTab extends React.Component<{ chart: ChartConfig }, undefined> {
	@computed get xAxis() { return this.props.chart.xAxis }
	@computed get yAxis() { return this.props.chart.yAxis }

	@action.bound onSlug(evt: React.FormEvent<HTMLInputElement>) { this.chart.slug = evt.currentTarget.value }

	render() {
		return <div id="axis-tab" className="tab-pane">
			<section>
				<h2>Refine your axis</h2>

				<div className="y-section">
					<h3>Y Axis</h3>
					<div className="input-wrapper">
						<label htmlFor="chart-y-axis-label">Y-Axis Label</label>
						<input className="form-control" type="text" name="chart-y-axis-label" />
					</div>
					<div className="input-wrapper">
						<label htmlFor="chart-y-axis-max">Y-Axis Max</label>
						<input className="form-control" type="text" name="chart-y-axis-max" />
					</div>
					<div className="input-wrapper">
						<label htmlFor="chart-y-axis-min">Y-Axis Min</label>
						<input className="form-control" type="text" name="chart-y-axis-min" />
					</div>
					<div className="input-wrapper">
						<label htmlFor="chart-y-axis-prefix">Y-Axis Prefix</label>
						<input className="form-control" type="text" name="chart-y-axis-prefix" />
					</div>
					<div className="input-wrapper">
						<label htmlFor="chart-y-axis-suffix">Y-Axis Suffix</label>
						<input className="form-control" type="text" name="chart-y-axis-suffix" />
					</div>
					<div className="input-wrapper">
						<label htmlFor="chart-y-axis-format">Y-Axis No of decimal places</label>
						<input className="form-control" type="text" name="chart-y-axis-format" />
					</div>
					<div className="input-wrapper">
						<label htmlFor="chart-y-scale">Y-Axis Scale</label>
						<select className="form-control" type="text" name="chart-y-axis-scale">
							<option value="linear">Linear</option>
							<option value="log">Log</option>
						</select>
					</div>
					<div className="input-wrapper axis-scale-selector-wrapper">
						<label htmlFor="y-axis-scale-selector">
							<input type="checkbox" name="y-axis-scale-selector" />
							User can select Y axis scale
						</label>
					</div>
				</div>
				<div className="x-section">
					<h3>X Axis</h3>
					<div className="input-wrapper">
						<label htmlFor="chart-x-axis-label">X-Axis Label</label>
						<input className="form-control" type="text" name="chart-x-axis-label" />
					</div>
					<div className="input-wrapper">
						<label htmlFor="chart-x-axis-max">X-Axis Max</label>
						<input className="form-control" type="text" name="chart-x-axis-max" />
					</div>
					<div className="input-wrapper">
						<label htmlFor="chart-x-axis-min">X-Axis Min</label>
						<input className="form-control" type="text" name="chart-x-axis-min" />
					</div>
					<div className="input-wrapper">
						<label htmlFor="chart-x-axis-prefix">X-Axis Prefix</label>
						<input className="form-control" type="text" name="chart-x-axis-prefix" />
					</div>
					<div className="input-wrapper">
						<label htmlFor="chart-x-axis-suffix">X-Axis Suffix</label>
						<input className="form-control" type="text" name="chart-x-axis-suffix" />
					</div>
					<div className="input-wrapper">
						<label htmlFor="chart-x-axis-format">X-Axis No of decimal places</label>
						<input className="form-control" type="text" name="chart-x-axis-format" />
					</div>
					<div className="input-wrapper">
						<label htmlFor="chart-y-scale">X-Axis Scale</label>
						<select className="form-control" type="text" name="chart-x-axis-scale">
							<option value="linear">Linear</option>
							<option value="log">Log</option>
						</select>
					</div>
					<div className="input-wrapper axis-scale-selector-wrapper">
						<label htmlFor="x-axis-scale-selector">
							<input type="checkbox" name="x-axis-scale-selector" />
							User can select X axis scale
						</label>
					</div>
				</div>
			</section>
		</div>
	}
}