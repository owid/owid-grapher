import * as _ from 'lodash'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import {computed, action, observable} from 'mobx'
import {observer} from 'mobx-react'
import ChartConfig from '../charts/ChartConfig'
import ChartType from '../charts/ChartType'
import {Toggle} from './Forms'
import EntityKey from '../charts/EntityKey'
import Color from '../charts/Color'
import {ChartEditor} from 'ChartEditor'
import {defaultTo} from '../charts/Util'
import {SelectField} from './Forms'
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

interface VariableSelectorProps {
	editor: ChartEditor,
	onClose: () => void
}

@observer
class VariableSelector extends React.Component<VariableSelectorProps, undefined> {
	@observable.ref chosenNamespace: string|undefined

	@computed get currentNamespace() {
		return defaultTo(this.chosenNamespace, this.props.editor.data.namespaces[0])
	}

	@action.bound onDismiss() {
		return this.props.onClose()
	}

	@action.bound onComplete() {

	}

	render() {
		const {chart} = this.props.editor
		const {namespaces} = this.props.editor.data
		const {currentNamespace} = this

		return <div className="editorModal VariableSelector">
			<div className="modal-dialog">
				<div className="modal-content">
					<div className="modal-header">
						<button type="button" className="close" onClick={this.onDismiss}><span aria-hidden="true">×</span></button>
						<h4 className="modal-title">Select variable from database</h4>
					</div>
					<div className="modal-body">
						<div className="form-variable-select-wrapper">
							<SelectField label="Database" options={namespaces} value={currentNamespace}/>
							
							<label className="variable-wrapper">
								Variable:
								<select name='chart-variable' data-placeholder="Select your variable" className="form-control form-variable-select chosen-select">
									{/*% for key, optgroup in data.optgroups.items %}
										<optgroup label="{{ optgroup.name }}">
											{% for variable in optgroup.variables %}
												<option title="{{ variable.description }}" data-namespace="{{ variable.namespace }}" data-unit="{{ variable.unit }}" value="{{ variable.id }}">{{ variable.name }}</option>
											{% endfor %}
										</optgroup>
									{% endfor %*/}
								</select>
							</label>
						</div>
					</div>
					<div className="modal-footer">
						<button type="button" className="btn btn-default pull-left" onClick={this.onDismiss}>Close</button>
						<button type="button" className="btn btn-primary" onClick={this.onComplete}>Add variable</button>
					</div>
				</div>
			</div>
		</div>
	}
}

@observer
class VariablesSection extends React.Component<{ editor: ChartEditor }, undefined> {
	@observable.ref isAddingVariable: boolean = true

	@action.bound onAddVariableStart() { this.isAddingVariable = true }
	@action.bound onAddVariableDone() {
		this.isAddingVariable = false
	}

	render() {
		const {props, isAddingVariable} = this

		return <div>
			<section className="add-data-section">
				<a className="add-data-btn" onClick={this.onAddVariableStart}><i className="fa fa-plus"/>Add variable</a>
				<div className="dd">
					<div className="dd-empty"></div>
				</div>
				<p className="form-section-desc hidden">Assign variables to the graph dimensions below by dragging them.</p>
			</section>
			<section className="dimensions-section">
				<input type="hidden" name="chart-dimensions" value="" />
			</section>
			{isAddingVariable && <VariableSelector editor={props.editor} onClose={this.onAddVariableDone}/>}
		</div>
	}
}

@observer
export default class EditorDataTab extends React.Component<{ editor: ChartEditor }, undefined> {
	render() {
		const {editor} = this.props

		return <div id="data-tab" className="tab-pane">
			<VariablesSection editor={editor}/>
			<EntitiesSection chart={editor.chart}/>
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