import * as _ from 'lodash'
import * as React from 'react'
import {observable, computed, action} from 'mobx'
import {observer} from 'mobx-react'
import ChartConfig, {DimensionSlot, ChartDimension} from '../charts/ChartConfig'
import {ChartTypeType} from '../charts/ChartType'
import {Toggle} from './Forms'
import {DimensionWithData} from '../charts/ChartData'
import ChartEditor, {Variable} from './ChartEditor'
import DimensionEditor from './DimensionEditor'
const styles = require("./EditorBasicTab.css")

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
			{canAddMore && <div className="dimensionSlot" onClick={this.onAddVariable}>Add variable{slot.allowMultiple && 's'}</div>}
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
export default class EditorBasicTab extends React.Component<{ editor: ChartEditor }> {
	@action.bound onChartType(evt: React.FormEvent<HTMLSelectElement>) { this.props.editor.chart.props.type = (evt.currentTarget.value as ChartTypeType) }

	render() {
		const {editor} = this.props
		const {chart} = editor

		return <div className={"tab-pane active " + styles.EditorBasicTab}>
			<section className="chart-type-section">
				<h2>What type of chart</h2>
				<select className="form-control chart-type-select" onChange={this.onChartType} ref={el => { if (el) el.value = chart.type }}>
					<option value="" disabled>Select type</option>
					<option value="LineChart">Line Chart</option>
					<option value="SlopeChart">Slope Chart</option>
					<option value="ScatterPlot">Scatter Plot</option>
					<option value="StackedArea">Stacked Area</option>
					<option value="DiscreteBar">Discrete Bar</option>
				</select>
				<Toggle label="Chart tab" value={chart.props.hasChartTab} onValue={value => chart.props.hasChartTab = value}/>
				{" "}<Toggle label="Map tab" value={chart.props.hasMapTab} onValue={value => chart.props.hasMapTab = value}/>
			</section>
			<VariablesSection editor={editor}/>
		</div>
	}
}