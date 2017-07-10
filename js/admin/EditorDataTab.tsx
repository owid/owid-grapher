import * as _ from 'lodash'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import {computed, action, observable} from 'mobx'
import {observer} from 'mobx-react'
import ChartConfig from '../charts/ChartConfig'
import ChartType from '../charts/ChartType'
import EntityKey from '../charts/EntityKey'
import Color from '../charts/Color'
import {defaultTo} from '../charts/Util'
import {SelectField, Toggle, NumberField} from './Forms'
import ChartEditor from './ChartEditor'
import EditorVariable from './EditorVariable'
/// XXXX todo

var ColorPicker = App.Views.UI.ColorPicker;

interface VariableSelectorProps {
	editor: ChartEditor,
	onDismiss: () => void,
	onComplete: (variable: EditorVariable) => void
}

@observer
class VariableSelector extends React.Component<VariableSelectorProps, undefined> {
	@observable.ref chosenNamespace: string|undefined
	@observable.ref chosenVariableId: number|undefined

	@computed get currentNamespace() {
		return defaultTo(this.chosenNamespace, this.props.editor.data.namespaces[0])
	}

	@computed get variables() {
		return _.filter(this.props.editor.data.variables, v => v.dataset.namespace == this.currentNamespace)
	}

	@computed get variablesByCategory() {
		return _.groupBy(this.variables, v => v.dataset.subcategory)
	}

	@computed get variablesById() {
		return _.keyBy(this.variables, 'id')
	}

	@computed get variableId() {
		return defaultTo(this.chosenVariableId, this.variables[0].id)
	}

	@action.bound onNamespace(namespace: string) {
		this.chosenVariableId = undefined
		this.chosenNamespace = namespace
	}

	@action.bound onVariable(ev: React.FormEvent<HTMLSelectElement>) {
		this.chosenVariableId = parseInt(ev.currentTarget.value)
	}

	@action.bound onDismiss() {
		this.props.onDismiss()
	}

	@action.bound onComplete() {
		this.props.onComplete(this.variablesById[this.variableId])
	}

	render() {
		const {chart} = this.props.editor
		const {namespaces} = this.props.editor.data
		const {currentNamespace, variablesByCategory, variableId} = this

		return <div className="editorModal VariableSelector">
			<div className="modal-dialog">
				<div className="modal-content">
					<div className="modal-header">
						<button type="button" className="close" onClick={this.onDismiss}><span aria-hidden="true">×</span></button>
						<h4 className="modal-title">Select variable from database</h4>
					</div>
					<div className="modal-body">
						<div className="form-variable-select-wrapper">
							<SelectField label="Database" options={namespaces} value={currentNamespace} onValue={this.onNamespace}/>
							
							<label className="variable-wrapper">
								Variable:
								<select data-placeholder="Select your variable" className="form-control form-variable-select chosen-select" onChange={this.onVariable} value={variableId}>
									{_.map(variablesByCategory, (variables, category) => {
										return <optgroup label={category}>
											{_.map(variables, variable => 
												<option title={variable.description} value={variable.id}>{variable.name}</option>
											)}
										</optgroup>
									})}
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
class VariableItem extends React.Component<{ variable: EditorVariable }, undefined> {
	render() {
		const {variable} = this.props

		return <li className="variable-label dd-item">
			<div className="dd-handle">
				<div className="dd-inner-handle">
					<span className="variable-label-name">{variable.name}</span>
				</div>
			</div>
			<span className="buttons">
				<span className="fa fa-paint-brush clickable" title="Set color"></span> <span className="fa fa-cog clickable" title="Variable settings"></span> <span className="fa fa-close clickable"></span>
			</span>
		</li>
	}
}

@observer
class VariablesSection extends React.Component<{ editor: ChartEditor }, undefined> {
	base: HTMLDivElement
	@observable.ref isAddingVariable: boolean = false
	@observable.struct unassignedVariables: EditorVariable[] = []

	@action.bound onAddVariableStart() { this.isAddingVariable = true }
	@action.bound onAddVariableDone(variable?: EditorVariable) {
		if (variable) {
			this.unassignedVariables.push(variable)
		}
		this.isAddingVariable = false
	}

	componentDidMount() {
		$(this.base).find(".dd").nestable()
	}

	render() {
		const {props, isAddingVariable, unassignedVariables} = this

		return <section className="add-data-section">
			<h2>Add your data</h2>
			<a className="add-data-btn" onClick={this.onAddVariableStart}><i className="fa fa-plus"/>Add variable</a>
			<div className="dd">
				{_.isEmpty(unassignedVariables) 
					? <div className="dd-empty"></div> 
					: <ol className="dd-list">
						{_.map(unassignedVariables, variable =>
							<VariableItem variable={variable}/>
						)}
					</ol>}
			</div>
			{unassignedVariables.length > 0 && <p className="form-section-desc">Assign variables to the graph dimensions below by dragging them.</p>}
			{isAddingVariable && <VariableSelector editor={props.editor} onDismiss={this.onAddVariableDone} onComplete={this.onAddVariableDone}/>}
		</section>
	}
}

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
		console.log("render")

		return <section className="entities-section">
			<h2>Pick your entities</h2>

			<p className="form-section-desc">You can set colors for individual entities by clicking on the labels.</p>
			<ul className="selected-countries-box no-bullets">
				{_.map(selectedEntities, entity =>
					<EntityItem chart={chart} entity={entity}/>
				)}
			</ul>
			<select className="form-control countries-select" onChange={this.onAddEntity} value="Select entity">
				<option value="Select entity" selected={true} disabled={true}>Select entity</option>
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
class TimeSection extends React.Component<{ editor: ChartEditor }, undefined> {
	base: HTMLDivElement

	@computed get chart() { return this.props.editor.chart }

	@computed get isDynamicTime() {
		return this.chart.props.timeDomain[0] == null && this.chart.props.timeDomain[1] == null
	}

	@computed get minTime() { return this.chart.props.timeDomain[0]||undefined }
	@computed get maxTime() { return this.chart.props.timeDomain[1]||undefined }
	@computed get minPossibleTime() { 
		return this.chart.data.primaryVariable ? this.chart.data.primaryVariable.minYear : 1900
	}
	@computed get maxPossibleTime() {
		return this.chart.data.primaryVariable ? this.chart.data.primaryVariable.maxYear : 2015
	}

	@action.bound onToggleDynamicTime() {
		if (this.isDynamicTime) {
			this.chart.props.timeDomain = [this.minPossibleTime, this.maxPossibleTime]
		} else {
			this.chart.props.timeDomain = [null, null]
		}
	}

	@action.bound onMinTime(value: number) {
		this.chart.props.timeDomain[0] = value
	}

	@action.bound onMaxTime(value: number) {
		this.chart.props.timeDomain[1] = value
	}

	render() {
		const {chart, minTime, maxTime, isDynamicTime} = this

		return <section className="time-section">
			<h2>Define your time</h2>
			<Toggle label="Use entire time period of the selected data" value={isDynamicTime} onValue={this.onToggleDynamicTime}/>

			{!isDynamicTime && <div>
				<div className="chart-time-inputs-wrapper">
					<NumberField label="Time from" value={minTime} onValue={this.onMinTime}/>
					<NumberField label="Time to" value={maxTime} onValue={this.onMaxTime}/>
				</div>
			</div>}
		</section>
	}
}

@observer
export default class EditorDataTab extends React.Component<{ editor: ChartEditor }, undefined> {
	render() {
		const {editor} = this.props

		return <div id="data-tab" className="tab-pane">
			<VariablesSection editor={editor}/>
			<EntitiesSection chart={editor.chart}/>
			<TimeSection editor={editor}/>
		</div>
	}
}