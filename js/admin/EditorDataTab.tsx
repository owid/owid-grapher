import * as _ from 'lodash'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import {computed, action, observable, when} from 'mobx'
import {observer} from 'mobx-react'
import ChartConfig, {DimensionSlot, ChartDimension} from '../charts/ChartConfig'
import {DimensionWithData} from '../charts/ChartData'
import ChartType from '../charts/ChartType'
import DataKey from '../charts/DataKey'
import Color from '../charts/Color'
import {defaultTo} from '../charts/Util'
import {SelectField, Toggle, NumberField} from './Forms'
import ChartEditor, {Variable} from './ChartEditor'
import Colorpicker from './Colorpicker'
import DimensionEditor from './DimensionEditor'
const styles = require("./EditorDataTab.css")

@observer
class VariableItem extends React.Component<{ variable: Variable }> {
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
class DimensionCard extends React.Component<{ dimension: DimensionWithData, editor: ChartEditor, onEdit: () => void, onRemove: () => void }> {
	render() {
		const {dimension, editor} = this.props
		return <div className="DimensionCard">
			<div>{dimension.name}</div>
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
		const {filledDimensions} = chart.data
		const {editingDimension} = this
		const canAddMore = slot.allowMultiple || filledDimensions.filter(d => d.property == slot.property).length == 0

		return <div>
			<h5>{slot.name}</h5>
			{filledDimensions.map((dim, i) => {
				return dim.property == slot.property && <DimensionCard dimension={dim} editor={editor} onEdit={action(() => this.editingDimensionIndex = i)} onRemove={() => this.removeDimension(i)}/>
			})}
			{canAddMore && <div className="dimensionSlot" onClick={this.onAddVariable}>Add variable</div>}
			{editingDimension && <DimensionEditor dimension={editingDimension} editor={editor} onDismiss={this.onUpdateDimension} onComplete={this.onUpdateDimension}/>}
		</div>
	}
}

@observer
class VariablesSection extends React.Component<{ editor: ChartEditor }> {
	base: HTMLDivElement
	@observable.ref isAddingVariable: boolean = false
	@observable.struct unassignedVariables: Variable[] = []

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

		return <li className="country-label clickable" style={{ backgroundColor: color||"white" }} onClick={e => this.isChoosingColor = true}>
			<span className="fa fa-remove" onClick={this.onRemove}/>
			{meta ? meta.fullLabel : datakey}
			{isChoosingColor && <Colorpicker color={color} onColor={this.onColor} onClose={() => this.isChoosingColor = false}/>}
		</li>
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

			<p className="form-section-desc">You can set individual colors by clicking on the labels.</p>
			<select className="form-control countries-select" onChange={this.onAddKey} value="Select data">
				<option value="Select data" selected={true} disabled={true}>Select data</option>
				{_.map(remainingKeys, key =>
					<option value={key}>{chart.data.lookupKey(key).fullLabel}</option>
				)}
			</select>
			<ul className="selected-countries-box no-bullets">
				{_.map(selectedKeys, datakey =>
					<DataKeyItem chart={chart} datakey={datakey}/>
				)}
			</ul>
			<div className="add-country-control-wrapper">
				<h4>Can user add/change data?</h4>
				<label>
					<input type="radio" name="add-country-mode" value="add-country" checked={chart.addCountryMode == "add-country"} onClick={e => chart.props.addCountryMode = "add-country"}/>
					User can add and remove data
				</label>
				<label>
					<input type="radio" name="add-country-mode" value="change-country" checked={chart.addCountryMode == "change-country"} onClick={e => chart.props.addCountryMode = "change-country"}/>
					User can change entity
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
		return this.chart.timeDomain[0] == null && this.chart.timeDomain[1] == null
	}

	@computed get minTime() { return this.chart.props.minTime }
	@computed get maxTime() { return this.chart.props.maxTime }
	@computed get minPossibleTime() { 
		return this.chart.data.primaryVariable ? this.chart.data.primaryVariable.minYear : 1900
	}
	@computed get maxPossibleTime() {
		return this.chart.data.primaryVariable ? this.chart.data.primaryVariable.maxYear : 2015
	}

	@action.bound onToggleDynamicTime() {
		if (this.isDynamicTime) {
			this.chart.timeDomain = [this.minPossibleTime, this.maxPossibleTime]
		} else {
			this.chart.timeDomain = [null, null]
		}
	}

	@action.bound onMinTime(value: number) {
		this.chart.props.minTime = value
	}

	@action.bound onMaxTime(value: number) {
		this.chart.props.maxTime = value
	}

	render() {
		const {chart, isDynamicTime} = this

		return <section className="time-section">
			<h2>Define your time</h2>
			<Toggle label="Use entire time period of the selected data" value={isDynamicTime} onValue={this.onToggleDynamicTime}/>

			{!isDynamicTime && <div>
				<div className="chart-time-inputs-wrapper">
					<NumberField label="Time from" value={chart.props.minTime} onValue={this.onMinTime}/>
					<NumberField label="Time to" value={chart.props.maxTime} onValue={this.onMaxTime}/>
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