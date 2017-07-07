import * as _ from 'lodash'
import * as React from 'react'
import {computed, action} from 'mobx'
import {observer} from 'mobx-react'
import ChartConfig from '../charts/ChartConfig'
import ChartType from '../charts/ChartType'
import {Toggle} from './Forms'
import EntityKey from '../charts/EntityKey'
import Color from '../charts/Color'
/// XXXX todo

var ColorPicker = App.Views.UI.ColorPicker;

@observer
class EntityItem extends React.Component<{ chart: ChartConfig, entity: EntityKey }, undefined> {
	@computed get entity() { return this.props.entity }
	@computed get color() { return this.props.chart.entityColors[this.props.entity] }

	base: HTMLLIElement
	colorPicker: any
	@action.bound onChooseColor() {
		if (this.colorPicker) this.colorPicker.onClose();
		this.colorPicker = new ColorPicker({ target: $(this.base), currentColor: this.color });
		this.colorPicker.onSelected = (color: Color) => {
			const entityColors = _.clone(this.props.chart.entityColors)
			entityColors[this.entity] = color
			this.props.chart.props.entityColors = entityColors
		}
	}

	@action.bound onRemove(ev: React.MouseEvent<HTMLSpanElement>) {
		this.props.chart.selectedEntities = this.props.chart.selectedEntities.filter(e => e != this.entity)
		ev.stopPropagation()
	}

	render() {
		const {entity, color} = this

		return <li className="country-label" style={{ backgroundColor: color||"white" }} onClick={this.onChooseColor}>
			<span className="fa fa-remove" onClick={this.onRemove}/>
			{entity}
		</li>
	}
}

@observer
class EntitiesSection extends React.Component<{ chart: ChartConfig }, undefined> {
	@action.bound onAddEntity(ev: React.ChangeEvent<HTMLSelectElement>) {
		this.props.chart.selectedEntities.push(ev.target.value)
	}

	render() {
		const {chart} = this.props
		const {selectedEntities, entityColors} = chart
		const {remainingEntities} = chart.vardata

		return <section className="entities-section">
			<h2>Pick your entities</h2>

			<p className="form-section-desc">You can set colors for individual entities by clicking on the labels.</p>
			<ul className="selected-countries-box no-bullets">
				{_.map(selectedEntities, entity =>
					<EntityItem chart={chart} entity={entity}/>
				)}
			</ul>
			<select className="form-control countries-select" onChange={this.onAddEntity}>
				<option selected disabled>Select entity</option>
				{_.map(remainingEntities, entity =>
					<option value={entity}>{entity}</option>
				)}
			</select>
			<div className="add-country-control-wrapper">
				<h4>Can user add/change entities?</h4>
				<label>
					<input type="radio" name="add-country-mode" value="add-country" selected={chart.addCountryMode == "add-country"} onClick={e => chart.props.addCountryMode = "add-country"}/>
					User can add and remove entities
				</label>
				<label>
					<input type="radio" name="add-country-mode" value="change-country" selected={chart.addCountryMode == "change-country"} onClick={e => chart.props.addCountryMode = "change-country"}/>
					User can change entity
				</label>
				<label>
					<input type="radio" name="add-country-mode" value="disabled" selected={chart.addCountryMode == "disabled"} onClick={e => chart.props.addCountryMode = "disabled"}/>
					User cannot change/add entity
				</label>
			</div>
		</section>
	}
}

@observer
export default class EditorDataTab extends React.Component<{ chart: ChartConfig }, undefined> {
	@computed get chart(): ChartConfig { return this.props.chart }

	render() {
		const { chart } = this

		return <div id="data-tab" className="tab-pane">
			<section className="add-data-section">
					<a className="add-data-btn"><i className="fa fa-plus"/>Add variable</a>
					<div className="dd">
						<div className="dd-empty"></div>
					</div>
				<p className="form-section-desc hidden">Assign variables to the graph dimensions below by dragging them.</p>
			</section>
			<section className="dimensions-section">
				<input type="hidden" name="chart-dimensions" value="" />
			</section>
			<EntitiesSection chart={chart}/>
			<section className="time-section">
				<h2>Define your time</h2>
				<label>
					<input type="checkbox" name="dynamic-time" checked={true}/>
					Use entire time period of the selected data
				</label>
				<input type="text" name="chart-time" value=""/>
				<div className="chart-time-inputs-wrapper">
					<label>
						Time from:
						<input type="text" name="chart-time-from" className="form-control" value="" />
					</label>
					<label>
						Time to:
						<input type="text" name="chart-time-to" className="form-control" value="" />
					</label>
				</div>
			</section>
		</div>
	}
}