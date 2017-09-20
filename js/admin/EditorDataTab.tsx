import * as React from 'react'
import {clone, map, debounce} from '../charts/Util'
import {computed, action, observable} from 'mobx'
import {observer} from 'mobx-react'
import ChartConfig from '../charts/ChartConfig'
import DataKey from '../charts/DataKey'
import Color from '../charts/Color'
import {NumberField} from './Forms'
import Colorpicker from './Colorpicker'
import ChartEditor from './ChartEditor'

interface DataKeyItemProps extends React.HTMLAttributes<HTMLLIElement> {
	chart: ChartConfig
	datakey: DataKey
}

@observer
class DataKeyItem extends React.Component<DataKeyItemProps> {
	@observable.ref isChoosingColor: boolean = false

	@computed get color() { return this.props.chart.data.keyColors[this.props.datakey] }

	@action.bound onColor(color: Color|undefined) {
		this.props.chart.data.setKeyColor(this.props.datakey, color)
	}

	@action.bound onRemove(ev: React.MouseEvent<HTMLSpanElement>) {
		this.props.chart.data.selectedKeys = this.props.chart.data.selectedKeys.filter(e => e != this.props.datakey)
		ev.stopPropagation()
	}

	render() {
		const {props, color, isChoosingColor} = this
		const {chart, datakey, ...rest} = props
		const meta = chart.data.keyData.get(datakey)

		return <li className="country-label clickable" style={{ backgroundColor: color||"white", width: "100%" }}{...rest}>
			<i className="fa fa-remove" onClick={this.onRemove}/>
			<i className="fa fa-paint-brush" onClick={_ => this.isChoosingColor = true} style={{position: 'relative'}}>
				{isChoosingColor && <Colorpicker color={color} onColor={this.onColor} onClose={() => this.isChoosingColor = false}/>}
			</i>
			{meta ? meta.fullLabel : datakey}
		</li>
	}
}

@observer
class KeysSection extends React.Component<{ chart: ChartConfig }> {
	@observable.ref dragKey?: DataKey

	@action.bound onAddKey(ev: React.ChangeEvent<HTMLSelectElement>) {
		this.props.chart.data.selectKey(ev.target.value)
	}

	@action.bound onStartDrag(key: DataKey) {
		this.dragKey = key

		const onDrag = action(() => {
			this.dragKey = undefined
			window.removeEventListener('mouseup', onDrag)
		})

		window.addEventListener('mouseup', onDrag)
	}

	@action.bound onMouseEnter(targetKey: DataKey) {
		if (!this.dragKey || targetKey == this.dragKey)
			return

		const selectedKeys = clone(this.props.chart.data.selectedKeys)
		const dragIndex = selectedKeys.indexOf(this.dragKey)
		const targetIndex = selectedKeys.indexOf(targetKey)
		selectedKeys.splice(dragIndex, 1)
		selectedKeys.splice(targetIndex, 0, this.dragKey)
		this.props.chart.data.selectedKeys = selectedKeys
	}

	render() {
		const {chart} = this.props
		const {selectedKeys, remainingKeys} = chart.data

		return <section className="entities-section">
			<h2>Choose data to show</h2>

			<select className="form-control countries-select" onChange={this.onAddKey} value="Select data">
				<option value="Select data" selected={true} disabled={true}>Select data</option>
				{map(remainingKeys, key =>
					<option value={key}>{chart.data.lookupKey(key).fullLabel}</option>
				)}
			</select>
			<ul className="selected-countries-box no-bullets">
				{map(selectedKeys, datakey =>
					<DataKeyItem chart={chart} datakey={datakey} onMouseDown={_ => this.onStartDrag(datakey)} onMouseEnter={_ => this.onMouseEnter(datakey)}/>
				)}
			</ul>
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

	@action.bound onMinTime(value: number|undefined) {
		this.chart.props.minTime = value
	}

	@action.bound onMaxTime(value: number|undefined) {
		this.chart.props.maxTime = value
	}

	render() {
		const {features} = this.props.editor
		const {chart} = this

		return <section className="time-section">
			{features.timeDomain && <NumberField label="Min year" value={chart.props.minTime} onValue={debounce(this.onMinTime)}/>}
			<NumberField label={features.timeDomain ? "Max year" : "Target year"} value={chart.props.maxTime} onValue={debounce(this.onMaxTime)}/>
		</section>
	}
}

@observer
export default class EditorDataTab extends React.Component<{ editor: ChartEditor }> {
	render() {
		const {editor} = this.props
		const {chart} = editor

		return <div className={"tab-pane"}>
			<section className="add-country-control-wrapper">
				<h4>Can user add/change data?</h4>
				<label>
					<input type="radio" name="add-country-mode" value="add-country" checked={chart.addCountryMode == "add-country"} onClick={_ => chart.props.addCountryMode = "add-country"}/>
					User can add and remove data
				</label>
				<label>
					<input type="radio" name="add-country-mode" value="change-country" checked={chart.addCountryMode == "change-country"} onClick={_ => chart.props.addCountryMode = "change-country"}/>
					User can change entity
				</label>
				<label>
					<input type="radio" name="add-country-mode" value="disabled" checked={chart.addCountryMode == "disabled"} onClick={_ => chart.props.addCountryMode = "disabled"}/>
					User cannot change/add data
				</label>
			</section>
			{!editor.chart.isScatter && <TimeSection editor={editor}/>}
			<KeysSection chart={editor.chart}/>
		</div>
	}
}