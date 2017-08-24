import * as _ from 'lodash'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import {computed, action, observable} from 'mobx'
import {observer} from 'mobx-react'
import ChartConfig, {DimensionSlot, ChartDimension} from '../charts/ChartConfig'
import ChartType from '../charts/ChartType'
import DataKey from '../charts/DataKey'
import Color from '../charts/Color'
import {defaultTo} from '../charts/Util'
import {SelectField, Toggle, NumberField} from './Forms'
import ChartEditor from './ChartEditor'
import EditorVariable from './EditorVariable'
import Colorpicker from './Colorpicker'
const styles = require("./EditorDataTab.css")

interface VariableSelectorProps {
	editor: ChartEditor,
	dimension?: ChartDimension,
	onDismiss: () => void,
	onComplete: (dimension: ChartDimension) => void
}

@observer
class VariableSelector extends React.Component<VariableSelectorProps> {
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
		this.props.onComplete(this.dimension)
	}

	@computed get dimension(): Partial<ChartDimension> {
		return _.extend({}, this.props.dimension||{}, {
			variableId: this.variableId
		})
/*		return {
			variableId: this.variableId,
			color?: string,
			displayName?: string,    
			isProjection?: boolean,
			order: number,
			property: string,
			targetYear?: number,
			tolerance: number,
			unit?: string
			
		}*/
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
class VariableItem extends React.Component<{ variable: EditorVariable }> {
	render() {
		const {variable} = this.props

		return <li className="variable-label dd-item">
			<div className="dd-handle">
				<div className="dd-inner-handle">
					<span className="variable-label-name">{variable.name}</span>
				</div>
			</div>
			<span className="buttons">
				<span className="fa fa-cog clickable" title="Variable settings"></span> <span className="fa fa-close clickable"></span>
			</span>
		</li>
	}
}

@observer
class DimensionCard extends React.Component<{ dimension: ChartDimension, editor: ChartEditor, onEdit: () => void, onRemove: () => void }> {
	render() {
		const {dimension, editor} = this.props
		const variable = editor.variablesById[dimension.variableId]
		return <div className="DimensionCard">
			<div>{variable.name}</div>
			<div className="buttons">
				<i className="fa fa-pencil clickable" onClick={this.props.onEdit}/> <i className="fa fa-close clickable" onClick={this.props.onRemove}/>
			</div>
		</div>
	}
}

@observer
class DimensionSlotView extends React.Component<{ slot: DimensionSlot, editor: ChartEditor }> {
	@observable editingDimensionIndex?: number

	@action.bound onAddVariable() {
		this.editingDimensionIndex = this.props.editor.chart.dimensions.length
	}

	@action.bound onUpdateDimension(dimension?: ChartDimension) {
		const {chart} = this.props.editor
		const {editingDimensionIndex} = this

		if (dimension && editingDimensionIndex !== undefined) {
			let dimensions = _.clone(chart.dimensions)
			if (editingDimensionIndex == dimensions.length) {
				dimensions.push(dimension)
			} else {
				dimensions[editingDimensionIndex] = dimension
			}
			chart.props.dimensions = dimensions
		}

		this.editingDimensionIndex = undefined
	}

	@action.bound removeDimension(index: number) {
		const {chart} = this.props.editor
		const dimensions = _.clone(chart.dimensions)
		dimensions.splice(index, 1)
		chart.props.dimensions = dimensions
	}

	@computed get editingDimension(): ChartDimension|undefined {
		if (this.editingDimensionIndex == null)
			return undefined

		const {slot, editor} = this.props

		if (this.editingDimensionIndex == editor.chart.dimensions.length) {
			const order = slot.dimensions.length > 0 ? slot.dimensions[slot.dimensions.length-1].order+1 : 0
			return {
				variableId: -1,
				property: this.props.slot.property,
				order: order
			}
		} else {
			return editor.chart.dimensions[this.editingDimensionIndex]
		}
	}

	render() {
		const {slot, editor} = this.props
		const {chart} = editor
		const {dimensions} = chart
		const {editingDimension} = this
		const canAddMore = slot.allowMultiple || dimensions.filter(d => d.property == slot.property).length == 0

		return <div>
			<h5>{slot.name}</h5>
			{dimensions.map((dim, i) => {
				return dim.property == slot.property && <DimensionCard dimension={dim} editor={editor} onEdit={action(() => this.editingDimensionIndex = i)} onRemove={() => this.removeDimension(i)}/>
			})}
			{canAddMore && <div className="dimensionSlot" onClick={this.onAddVariable}>Add variable</div>}
			{editingDimension && <VariableSelector editor={editor} dimension={editingDimension} onDismiss={this.onUpdateDimension} onComplete={this.onUpdateDimension}/>}
		</div>
	}
}

@observer
class VariablesSection extends React.Component<{ editor: ChartEditor }> {
	base: HTMLDivElement
	@observable.ref isAddingVariable: boolean = false
	@observable.struct unassignedVariables: EditorVariable[] = []

    @computed get slots(): DimensionSlot[] {
		return this.props.editor.chart.emptyDimensionSlots
    }

	render() {
		const {props, isAddingVariable, unassignedVariables, slots} = this

		return <section className="add-data-section">
			<h2>Add variables</h2>
			{slots.map(slot => <DimensionSlotView slot={slot} editor={props.editor}/>)}
		</section>
	}
}

@observer
class DataKeyItem extends React.Component<{ chart: ChartConfig, datakey: DataKey }> {
	@observable.ref isChoosingColor: boolean = false

	@computed get datakey() { return this.props.datakey }
	@computed get color() { return this.props.chart.data.keyColors[this.props.datakey] }

	@action.bound onColor(color: Color|undefined) {
		this.props.chart.data.setKeyColor(this.datakey, color)
	}

	@action.bound onRemove(ev: React.MouseEvent<HTMLSpanElement>) {
		this.props.chart.data.selectedKeys = this.props.chart.data.selectedKeys.filter(e => e != this.datakey)
		ev.stopPropagation()
	}

	render() {
		const {props, datakey, color, isChoosingColor} = this
		const meta = props.chart.data.keyData.get(datakey)

		return <li className="country-label" style={{ backgroundColor: color||"white" }} onClick={e => this.isChoosingColor = true}>
			<span className="fa fa-remove" onClick={this.onRemove}/>
			{meta ? meta.fullLabel : datakey}
			{isChoosingColor && <Colorpicker color={color} onColor={this.onColor} onClose={() => this.isChoosingColor = false}/>}
		</li>
	}
}

@observer
class ColorSchemeSelector extends React.Component<{ chart: ChartConfig }> {
	@action.bound onValue(value: string) {
		this.props.chart.props.baseColorScheme = value == 'default' ? undefined : value
	}

	render() {
		const {chart} = this.props
		const colorSchemes = ['default']
		return <SelectField label="Color scheme" value={chart.baseColorScheme||"default"} onValue={this.onValue} options={colorSchemes}/>
	}
}

@observer
class KeysSection extends React.Component<{ chart: ChartConfig }> {
	@action.bound onAddKey(ev: React.ChangeEvent<HTMLSelectElement>) {
		this.props.chart.data.selectedKeys = this.props.chart.data.selectedKeys.concat([ev.target.value])
	}

	render() {
		const {chart} = this.props
		const {selectedKeys, remainingKeys} = chart.data

		return <section className="entities-section">
			<h2>Choose data to show</h2>

			<ColorSchemeSelector chart={chart}/>

			<p className="form-section-desc">You can set individual colors by clicking on the labels.</p>
			<ul className="selected-countries-box no-bullets">
				{_.map(selectedKeys, datakey =>
					<DataKeyItem chart={chart} datakey={datakey}/>
				)}
			</ul>
			<select className="form-control countries-select" onChange={this.onAddKey} value="Select data">
				<option value="Select data" selected={true} disabled={true}>Select data</option>
				{_.map(remainingKeys, key =>
					<option value={key}>{chart.data.formatKey(key)}</option>
				)}
			</select>
			<div className="add-country-control-wrapper">
				<h4>Can user add/change data?</h4>
				<label>
					<input type="radio" name="add-country-mode" value="add-country" checked={chart.addCountryMode == "add-country"} onClick={e => chart.props.addCountryMode = "add-country"}/>
					User can add and remove data
				</label>
				<label>
					<input type="radio" name="add-country-mode" value="change-country" checked={chart.addCountryMode == "change-country"} onClick={e => chart.props.addCountryMode = "change-country"}/>
					User can change data
				</label>
				<label>
					<input type="radio" name="add-country-mode" value="disabled" checked={chart.addCountryMode == "disabled"} onClick={e => chart.props.addCountryMode = "disabled"}/>
					User cannot change/add data
				</label>
			</div>
		</section>
	}
}

@observer
class TimeSection extends React.Component<{ editor: ChartEditor }> {
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
export default class EditorDataTab extends React.Component<{ editor: ChartEditor }> {
	render() {
		const {editor} = this.props

		return <div className={"tab-pane " + styles.EditorDataTab}>
			<VariablesSection editor={editor}/>
			<KeysSection chart={editor.chart}/>
			<TimeSection editor={editor}/>
		</div>
	}
}