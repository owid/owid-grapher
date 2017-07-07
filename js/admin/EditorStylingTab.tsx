import * as _ from 'lodash'
import * as React from 'react'
import {computed, action} from 'mobx'
import {observer} from 'mobx-react'
import ChartConfig from '../charts/ChartConfig'
import ChartType from '../charts/ChartType'
import {Toggle} from './Forms'


/// XXXX todo

@observer
export default class EditorStylingTab extends React.Component<{ chart: ChartConfig }, undefined> {
	get chart(): ChartConfig {
		return this.props.chart
	}

	render() {
		const { chart } = this

		return <div id="styling-tab" className="tab-pane">
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
		</div>
	}
}