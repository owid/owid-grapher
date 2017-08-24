import * as _ from 'lodash'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import {computed, action, observable} from 'mobx'
import {observer} from 'mobx-react'
import ChartConfig from '../charts/ChartConfig'
import ChartEditor from './ChartEditor'
import {NumericSelectField, NumberField, SelectField, TextField, Toggle} from './Forms'
import MapConfig from '../charts/MapConfig'
import MapData from '../charts/MapData'
import MapProjections from '../charts/MapProjections'
import MapProjection from '../charts/MapProjection'
import ColorSchemes from '../charts/ColorSchemes'
import {NumericBin, CategoricalBin} from '../charts/MapData'
import Color from '../charts/Color'
import Colorpicker from './Colorpicker'

@observer
class VariableSection extends React.Component<{ map: MapConfig }> {
	@action.bound onVariableId(variableId: number) {
		this.props.map.props.variableId = variableId
	}

	render() {
		const {map} = this.props

		return <section>
			<h2>Which variable on map</h2>
			<NumericSelectField value={map.variableId} options={_.map(map.data.vardata.variables, 'id')} optionLabels={_.map(map.data.vardata.variables, 'name')} onValue={this.onVariableId}/>
		</section>

	}
}

@observer
class TimelineSection extends React.Component<{ map: MapConfig }> {
	@action.bound onTolerance(tolerance: number) {
		this.props.map.props.timeTolerance = tolerance
	}

	render() {
		const {map} = this.props
		return <section>
			<h2>Timeline</h2>
			<label>
				<NumberField label="Tolerance of data" value={map.props.timeTolerance} onValue={this.onTolerance} min={0}/>
				<p className="form-section-desc">Specify a range of years from which to pull data. For example, if the map shows 1990 and tolerance is set to 1, then data from 1989 or 1991 will be shown if no data is available for 1990.</p>
			</label>
		</section>
	}
}

@observer
class ColorBox extends React.Component<{ color: Color, onColor: (color: Color) => void }> {
	@observable.ref isChoosingColor = false

	@action.bound onClick() {
		this.isChoosingColor = !this.isChoosingColor
	}

	render() {
		const {color} = this.props
		const {isChoosingColor} = this

		return <span className="map-color-scheme-icon" style={{backgroundColor: color}} onClick={this.onClick}>
			{isChoosingColor && <Colorpicker color={color} onColor={this.props.onColor} onClose={() => this.isChoosingColor = false}/>}
		</span>
	}
}

@observer
class NumericBinView extends React.Component<{ map: MapConfig, bin: NumericBin, index: number }> {
	@action.bound onColor(color: Color) {
		const {map, index} = this.props

		if (!map.isCustomColors) {
			// Creating a new custom color scheme
			map.props.customCategoryColors = {}
			map.props.customNumericColors = []
			map.props.customColorsActive = true
		}

		while (map.props.customNumericColors.length < map.numBuckets)
			map.props.customNumericColors.push(undefined)
		map.props.customNumericColors[index] = color
	}

	@action.bound onMaximumValue(value: number) {
		const {map, index} = this.props
		while (map.props.colorSchemeValues.length < map.numBuckets)
			map.props.colorSchemeValues.push(undefined)
		map.props.colorSchemeValues[index] = value
	}

	@action.bound onLabel(value: string) {
		const {map, index} = this.props
		while (map.props.colorSchemeLabels.length < map.numBuckets)
			map.props.colorSchemeLabels.push(undefined)
		map.props.colorSchemeLabels[index] = value
	}

	render() {
		const {map, bin, index} = this.props

		const max = index+1 < map.colorSchemeValues.length ? map.colorSchemeValues[index+1] : undefined

		return <li className="numeric clearfix">
			<ColorBox color={bin.color} onColor={this.onColor}/>
			<NumberField placeholder="Maximum value" min={bin.min} value={bin.max} max={max} onValue={this.onMaximumValue} disabled={map.isAutoBuckets}/>
			<TextField placeholder="Custom label" value={bin.label} onValue={this.onLabel}/>
		</li>
	}
}

@observer
class CategoricalBinView extends React.Component<{ map: MapConfig, bin: CategoricalBin }> {
	@action.bound onColor(color: Color) {
		const {map, bin} = this.props
		if (!map.isCustomColors) {
			// Creating a new custom color scheme
			map.props.customCategoryColors = {}
			map.props.customNumericColors = []
			map.props.customColorsActive = true
		}

		const customCategoryColors = _.clone(map.props.customCategoryColors)
		customCategoryColors[bin.value] = color
		map.props.customCategoryColors = customCategoryColors		
	}

	@action.bound onLabel(value: string) {
		const {map, bin} = this.props
		const customCategoryLabels = _.clone(map.props.customCategoryLabels)
		customCategoryLabels[bin.value] = value
		map.props.customCategoryLabels = customCategoryLabels
	}

	@action.bound onToggleHidden() {
		const {map, bin} = this.props
		
		const customHiddenCategories = _.clone(map.props.customHiddenCategories)
		if (bin.isHidden)
			delete customHiddenCategories[bin.value]
		else
			customHiddenCategories[bin.value] = true
		map.props.customHiddenCategories = customHiddenCategories
	}	

	render() {
		const {map, bin} = this.props

		return <li className="categorical clearfix">
			<ColorBox color={bin.color} onColor={this.onColor}/>
			<TextField value={bin.value} disabled={true} onValue={_.noop}/>
			<TextField placeholder="Custom label" value={bin.label} onValue={this.onLabel}/>
			<Toggle label="Hide" value={bin.isHidden} onValue={this.onToggleHidden}/>
		</li>
	}
}

@observer
class ColorSchemeEditor extends React.Component<{ map: MapConfig }> {
	@action.bound onMinimalValue(value: number) {
		this.props.map.props.colorSchemeMinValue = value
	}

	render() {
		const {map} = this.props		
		if (!map.data) return null

		return <ul className="map-color-scheme-preview clearfix automatic-values">
			{map.data.variable.hasNumericValues && <li className='clearfix min-color-wrapper'>
				<NumberField label="Minimal value:" value={map.props.colorSchemeMinValue} onValue={this.onMinimalValue}/>
			 </li>}

			{_.map(map.data.legendData, (bin, index) => {
				if (bin instanceof NumericBin) {
					return <NumericBinView map={map} bin={bin} index={index}/>
				} else {
					return <CategoricalBinView map={map} bin={bin}/>
				}
			})}
		</ul>
	}
}

@observer
class ColorsSection extends React.Component<{ map: MapConfig }> {
	@action.bound onColorScheme(schemeKey: string) {
		const {map} = this.props
		if (schemeKey == 'custom') {
			map.props.customColorsActive = true
		} else {
			map.props.baseColorScheme = schemeKey
			map.props.customColorsActive = undefined
		}
	}

	@action.bound onNumIntervals(numIntervals: number) {
		this.props.map.props.colorSchemeInterval = numIntervals
	}

	@action.bound onInvert(invert: boolean) {
		this.props.map.props.colorSchemeInvert = invert||undefined
	}

	@action.bound onAutomatic(isAutomatic: boolean) {
		this.props.map.props.colorSchemeValuesAutomatic = isAutomatic||undefined
	}

	render() {
		const {map} = this.props

		const availableColorSchemes = _(ColorSchemes).map((v: any, k: any) => _.extend({}, v, { key: k })).filter((v: any) => !!v.name).value()
		const currentColorScheme = map.isCustomColors ? 'custom' : map.props.baseColorScheme

		return <section>
			<h2>Colors</h2>
			<SelectField label="Color scheme:" value={currentColorScheme} options={_.map(availableColorSchemes, 'key')} onValue={this.onColorScheme}/>
			<NumberField label="Number of intervals:" value={map.props.colorSchemeInterval} min={1} max={99} onValue={this.onNumIntervals}/>
			<Toggle label="Invert colors" value={map.props.colorSchemeInvert||false} onValue={this.onInvert}/>
			<Toggle label="Automatic classification" value={map.props.colorSchemeValuesAutomatic||false} onValue={this.onAutomatic}/>
			<ColorSchemeEditor map={map}/>
		</section>
	}
}

@observer
class MapProjectionSection extends React.Component<{ map: MapConfig }> {
	@action.bound onProjection(projection: string) {
		this.props.map.props.projection = (projection as MapProjection)
	}

	render() {
		const {map} = this.props
		const projections = ['World', 'Africa', 'NorthAmerica', 'SouthAmerica', 'Asia', 'Europe', 'Australia']
		return <section>
			<h2>Displayed region</h2>
			<SelectField label="Which region map should be focused on:" value={map.props.projection} options={projections} onValue={this.onProjection}/>
		</section>
	}
}

@observer
class MapLegendSection extends React.Component<{ map: MapConfig }> {
	@action.bound onDescription(description: string|undefined) {
		this.props.map.props.legendDescription = description
	}

	render() {
		const {map} = this.props
		return <section className="map-legend-section">
			<h2>Legend</h2>
			<TextField label="Legend description:" value={map.props.legendDescription} onValue={this.onDescription}/>
		</section>
	}
}

@observer
export default class EditorMapTab extends React.Component<{ editor: ChartEditor }> {
	@computed get chart() { return this.props.editor.chart } 
	@computed get map() { return this.chart.map as MapConfig }

	render() {
		const {chart, map} = this

		return <div className="tab-pane">
			<VariableSection map={map}/>
			{map.data.isReady && 
				[<TimelineSection map={map}/>,
				<ColorsSection map={map}/>,
				<MapProjectionSection map={map}/>,
				<MapLegendSection map={map}/>]
			}
		</div>
	}
}