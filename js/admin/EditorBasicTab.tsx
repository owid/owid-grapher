import * as _ from 'lodash'
import * as React from 'react'
import {observable, computed, action, when, IReactionDisposer} from 'mobx'
import {observer} from 'mobx-react'
import ChartConfig, {DimensionSlot, ChartDimension} from '../charts/ChartConfig'
import {ChartTypeType} from '../charts/ChartType'
import {TextField, Toggle, NumberField} from './Forms'
import {DimensionWithData} from '../charts/ChartData'
import ChartEditor, {Variable} from './ChartEditor'
import VariableSelector from './VariableSelector'
const styles = require("./EditorBasicTab.css")

@observer
class DimensionCard extends React.Component<{ dimension: DimensionWithData, editor: ChartEditor, onEdit?: () => void, onRemove?: () => void }> {
	@observable.ref isExpanded: boolean = false

	@computed get hasExpandedOptions() {
		return this.props.dimension.property == 'y' || this.props.dimension.property == 'x'
	}

	@action.bound onToggleExpand() {
		this.isExpanded = !this.isExpanded
	}

	@action.bound onIsProjection(value: boolean) {
		this.props.dimension.props.isProjection = value||undefined
	}

	@action.bound onDisplayName(value: string) {
		this.props.dimension.props.displayName = value||undefined
	}

	@action.bound onUnit(value: string) {
		this.props.dimension.props.unit = value||undefined
	}

	@action.bound onShortUnit(value: string) {
		this.props.dimension.props.shortUnit = value||undefined
	}

	@action.bound onTolerance(value: number|undefined) {
		this.props.dimension.props.tolerance = value
	}

	render() {
		const {dimension, editor} = this.props
		const {chart} = editor

		return <div className="DimensionCard">
			<header>
				{this.props.onEdit && <span className="clickable" onClick={this.props.onEdit} style={{'margin-right': '10px'}}><i className="fa fa-exchange"/></span>}
				{this.props.onRemove && <span className="clickable" onClick={this.props.onRemove} style={{'margin-right': '10px'}}><i className="fa fa-times"/></span>}
				<div>{dimension.variable.name}</div>
				{this.hasExpandedOptions && <div className="clickable" onClick={this.onToggleExpand}><i className={"fa fa-chevron-" + (this.isExpanded ? 'up' : 'down')}/></div>}
			</header>
			{this.isExpanded && <div>
				<TextField label="Display name" value={dimension.props.displayName} onValue={this.onDisplayName} placeholder={dimension.displayName}/>
				<TextField label="Unit" value={dimension.props.unit} onValue={this.onUnit} placeholder={dimension.unit}/>
				<TextField label="Short unit" value={dimension.props.shortUnit} onValue={this.onShortUnit} placeholder={dimension.shortUnit}/>
				{(chart.isScatter || chart.isDiscreteBar) && <NumberField label="Tolerance" value={dimension.props.tolerance} onValue={this.onTolerance} placeholder={_.toString(dimension.tolerance)}/>}
				{chart.isLineChart && <Toggle label="Is projection" value={!!dimension.props.isProjection} onValue={this.onIsProjection}/>}
			</div>}
		</div>
	}
}

@observer
class DimensionSlotView extends React.Component<{ slot: DimensionSlot, editor: ChartEditor }> {
	@observable.ref isSelectingVariables: boolean = false

	@action.bound onVariables(variableIds: number[]) {
		const {slot} = this.props

		slot.dimensions = variableIds.map(id => {
			const existingDimension = slot.dimensions.find(d => d.variableId == id)
			return existingDimension || slot.createDimension(id)
		})

		this.isSelectingVariables = false
		this.updateDefaults()
	}

	@action.bound onRemoveDimension(dim: DimensionWithData) {
		this.props.slot.dimensions = this.props.slot.dimensions.filter(d => d.variableId != dim.variableId)
		this.updateDefaults()
	}

	updateDefaults() {
		const {chart} = this.props.editor
		when(
			() => !!(chart.type && chart.data.primaryDimensions),
			() => {
				if (chart.isScatter || chart.isSlopeChart) {
					chart.data.selectedKeys = []
				} else if (chart.data.primaryDimensions.length > 1) {
					const entity = _.includes(chart.data.availableEntities, "World") ? "World" : _.sample(chart.data.availableEntities)
					chart.data.selectedKeys = chart.data.availableKeys.filter(key => chart.data.lookupKey(key).entity == entity)
					chart.props.addCountryMode = 'change-country'
				} else {
					chart.data.selectedKeys = chart.data.availableKeys.length > 10 ? _.sampleSize(chart.data.availableKeys, 3) : chart.data.availableKeys
					chart.props.addCountryMode = 'add-country'
				}
			}
		)
		
	}
	
	render() {
		const {isSelectingVariables} = this
		const {slot, editor} = this.props
		const {chart} = editor
		const canAddMore = slot.allowMultiple || slot.dimensions.length == 0

		return <div>
			<h5>{slot.name}</h5>
			{slot.dimensionsWithData.map((dim, i) => {
				return dim.property == slot.property && <DimensionCard dimension={dim} editor={editor} onEdit={slot.allowMultiple ? undefined : action(() => this.isSelectingVariables = true)} onRemove={slot.allowMultiple ? () => this.onRemoveDimension(dim) : undefined}/>
			})}
			{canAddMore && <div className="dimensionSlot" onClick={action(() => this.isSelectingVariables = true)}>Add variable{slot.allowMultiple && 's'}</div>}
			{isSelectingVariables && <VariableSelector editor={editor} slot={slot} onDismiss={action(() => this.isSelectingVariables = false)} onComplete={this.onVariables}/>}
		</div>
	}
}

@observer
class VariablesSection extends React.Component<{ editor: ChartEditor }> {
	base: HTMLDivElement
	@observable.ref isAddingVariable: boolean = false
	@observable.struct unassignedVariables: Variable[] = []

	render() {
		const {props, isAddingVariable, unassignedVariables} = this
		const {dimensionSlots} = props.editor.chart

		return <section className="add-data-section">
			<h2>Add variables</h2>
			{dimensionSlots.map(slot => <DimensionSlotView slot={slot} editor={props.editor}/>)}
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