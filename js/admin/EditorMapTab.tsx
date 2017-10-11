import * as React from 'react'
import { clone, isEmpty, noop, extend, map } from '../charts/Util'
import { computed, action, observable } from 'mobx'
import { observer } from 'mobx-react'
import ChartEditor from './ChartEditor'
import { NumericSelectField, NumberField, SelectField, TextField, Toggle } from './Forms'
import MapConfig from '../charts/MapConfig'
import MapProjection from '../charts/MapProjection'
import ColorSchemes from '../charts/ColorSchemes'
import { NumericBin, CategoricalBin } from '../charts/MapData'
import Color from '../charts/Color'
import Colorpicker from './Colorpicker'

@observer
class VariableSection extends React.Component<{ mapConfig: MapConfig }> {
    @action.bound onVariableId(variableId: number) {
        this.props.mapConfig.props.variableId = variableId
    }

    render() {
        const {mapConfig} = this.props
        const { filledDimensions } = mapConfig.chart.data

        if (isEmpty(filledDimensions))
            return <section>
                <h2>Add some variables on data tab first</h2>
            </section>

        return <section>
            <h2>Which variable on map</h2>
            <NumericSelectField value={mapConfig.variableId} options={filledDimensions.map(d => d.variableId)} optionLabels={filledDimensions.map(d => d.displayName)} onValue={this.onVariableId} />
        </section>

    }
}

@observer
class TimelineSection extends React.Component<{ mapConfig: MapConfig }> {
    @action.bound onToggleHideTimeline(value: boolean) {
        this.props.mapConfig.props.hideTimeline = value||undefined
    }

    @action.bound onTolerance(tolerance: number) {
        this.props.mapConfig.props.timeTolerance = tolerance
    }

    render() {
        const {mapConfig} = this.props
        return <section>
            <h2>Timeline</h2>
            <Toggle label="Hide timeline" value={!!mapConfig.props.hideTimeline} onValue={this.onToggleHideTimeline}/>
            <label>
                <NumberField label="Tolerance of data" value={mapConfig.props.timeTolerance} onValue={this.onTolerance} min={0} />
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
        const { color } = this.props
        const { isChoosingColor } = this

        return <span className="map-color-scheme-icon" style={{ backgroundColor: color }} onClick={this.onClick}>
            {isChoosingColor && <Colorpicker color={color} onColor={this.props.onColor} onClose={() => this.isChoosingColor = false} />}
        </span>
    }
}

@observer
class NumericBinView extends React.Component<{ mapConfig: MapConfig, bin: NumericBin, index: number }> {
    @action.bound onColor(color: Color) {
        const { mapConfig, index } = this.props

        if (!mapConfig.isCustomColors) {
            // Creating a new custom color scheme
            mapConfig.props.customCategoryColors = {}
            mapConfig.props.customNumericColors = []
            mapConfig.props.customColorsActive = true
        }

        while (mapConfig.props.customNumericColors.length < mapConfig.numBuckets)
            mapConfig.props.customNumericColors.push(undefined)
        mapConfig.props.customNumericColors[index] = color
    }

    @action.bound onMaximumValue(value: number) {
        const { mapConfig, index } = this.props
        while (mapConfig.props.colorSchemeValues.length < mapConfig.numBuckets)
            mapConfig.props.colorSchemeValues.push(undefined)
        mapConfig.props.colorSchemeValues[index] = value
    }

    @action.bound onLabel(value: string) {
        const { mapConfig, index } = this.props
        while (mapConfig.props.colorSchemeLabels.length < mapConfig.numBuckets)
            mapConfig.props.colorSchemeLabels.push(undefined)
        mapConfig.props.colorSchemeLabels[index] = value
    }

    render() {
        const { mapConfig, bin, index } = this.props

        const max = index + 1 < mapConfig.colorSchemeValues.length ? mapConfig.colorSchemeValues[index + 1] : undefined

        return <li className="numeric clearfix">
            <ColorBox color={bin.color} onColor={this.onColor} />
            <NumberField placeholder="Maximum value" min={bin.min} value={bin.max} max={max} onValue={this.onMaximumValue} disabled={mapConfig.isAutoBuckets} />
            <TextField placeholder="Custom label" value={bin.label} onValue={this.onLabel} />
        </li>
    }
}

@observer
class CategoricalBinView extends React.Component<{ mapConfig: MapConfig, bin: CategoricalBin }> {
    @action.bound onColor(color: Color) {
        const { mapConfig, bin } = this.props
        if (!mapConfig.isCustomColors) {
            // Creating a new custom color scheme
            mapConfig.props.customCategoryColors = {}
            mapConfig.props.customNumericColors = []
            mapConfig.props.customColorsActive = true
        }

        const customCategoryColors = clone(mapConfig.props.customCategoryColors)
        customCategoryColors[bin.value] = color
        mapConfig.props.customCategoryColors = customCategoryColors
    }

    @action.bound onLabel(value: string) {
        const { mapConfig, bin } = this.props
        const customCategoryLabels = clone(mapConfig.props.customCategoryLabels)
        customCategoryLabels[bin.value] = value
        mapConfig.props.customCategoryLabels = customCategoryLabels
    }

    @action.bound onToggleHidden() {
        const { mapConfig, bin } = this.props

        const customHiddenCategories = clone(mapConfig.props.customHiddenCategories)
        if (bin.isHidden)
            delete customHiddenCategories[bin.value]
        else
            customHiddenCategories[bin.value] = true
        mapConfig.props.customHiddenCategories = customHiddenCategories
    }

    render() {
        const { bin } = this.props

        return <li className="categorical clearfix">
            <ColorBox color={bin.color} onColor={this.onColor} />
            <TextField value={bin.value} disabled={true} onValue={noop} />
            <TextField placeholder="Custom label" value={bin.label} onValue={this.onLabel} />
            <Toggle label="Hide" value={bin.isHidden} onValue={this.onToggleHidden} />
        </li>
    }
}

@observer
class ColorSchemeEditor extends React.Component<{ map: MapConfig }> {
    @action.bound onMinimalValue(value: number) {
        this.props.map.props.colorSchemeMinValue = value
    }

    render() {
        const mapConfig = this.props.map
        const { dimension } = mapConfig.data
        if (!dimension) return null

        return <ul className="map-color-scheme-preview clearfix automatic-values">
            {dimension.variable.hasNumericValues && <li className='clearfix min-color-wrapper'>
                <NumberField label="Minimal value:" value={mapConfig.props.colorSchemeMinValue} onValue={this.onMinimalValue} />
            </li>}

            {map(mapConfig.data.legendData, (bin, index) => {
                if (bin instanceof NumericBin) {
                    return <NumericBinView mapConfig={mapConfig} bin={bin} index={index} />
                } else {
                    return <CategoricalBinView mapConfig={mapConfig} bin={bin} />
                }
            })}
        </ul>
    }
}

@observer
class ColorsSection extends React.Component<{ mapConfig: MapConfig }> {
    @action.bound onColorScheme(schemeKey: string) {
        const { mapConfig } = this.props
        if (schemeKey === 'custom') {
            mapConfig.props.customColorsActive = true
        } else {
            mapConfig.props.baseColorScheme = schemeKey
            mapConfig.props.customColorsActive = undefined
        }
    }

    @action.bound onNumIntervals(numIntervals: number) {
        this.props.mapConfig.props.colorSchemeInterval = numIntervals
    }

    @action.bound onInvert(invert: boolean) {
        this.props.mapConfig.props.colorSchemeInvert = invert || undefined
    }

    @action.bound onAutomatic(isAutomatic: boolean) {
        this.props.mapConfig.props.isManualBuckets = isAutomatic ? undefined : true
    }

    render() {
        const {mapConfig} = this.props
        const availableColorSchemes = map(ColorSchemes, (v: any, k: any) => extend({}, v, { key: k })).filter((v: any) => !!v.name)
        const currentColorScheme = mapConfig.isCustomColors ? 'custom' : mapConfig.baseColorScheme

        return <section>
            <h2>Colors</h2>
            <SelectField label="Color scheme:" value={currentColorScheme} options={availableColorSchemes.map(d => d.key).concat(['custom'])} optionLabels={availableColorSchemes.map(d => d.name).concat(['custom'])} onValue={this.onColorScheme} />
            <NumberField label="Number of intervals:" value={mapConfig.props.colorSchemeInterval} min={1} max={99} onValue={this.onNumIntervals} />
            <Toggle label="Invert colors" value={mapConfig.props.colorSchemeInvert || false} onValue={this.onInvert} />
            <Toggle label="Automatic classification" value={!mapConfig.props.isManualBuckets} onValue={this.onAutomatic} />
            <ColorSchemeEditor map={mapConfig} />
        </section>
    }
}

@observer
class MapProjectionSection extends React.Component<{ mapConfig: MapConfig }> {
    @action.bound onProjection(projection: string) {
        this.props.mapConfig.props.projection = (projection as MapProjection)
    }

    render() {
        const { mapConfig } = this.props
        const projections = ['World', 'Africa', 'NorthAmerica', 'SouthAmerica', 'Asia', 'Europe', 'Australia']
        return <section>
            <h2>Displayed region</h2>
            <SelectField label="Which region map should be focused on:" value={mapConfig.props.projection} options={projections} onValue={this.onProjection} />
        </section>
    }
}

@observer
class MapLegendSection extends React.Component<{ mapConfig: MapConfig }> {
    @action.bound onDescription(description: string | undefined) {
        this.props.mapConfig.props.legendDescription = description
    }

    render() {
        const { mapConfig } = this.props
        return <section className="map-legend-section">
            <h2>Legend</h2>
            <TextField label="Legend description:" value={mapConfig.props.legendDescription} onValue={this.onDescription} />
        </section>
    }
}

@observer
export default class EditorMapTab extends React.Component<{ editor: ChartEditor }> {
    @computed get chart() { return this.props.editor.chart }
    @computed get mapConfig() { return this.chart.map as MapConfig }

    render() {
        const { mapConfig } = this

        return <div className="EditorMapTab tab-pane">
            <VariableSection mapConfig={mapConfig} />
            {mapConfig.data.isReady &&
                [<TimelineSection mapConfig={mapConfig} />,
                <ColorsSection mapConfig={mapConfig} />,
                <MapProjectionSection mapConfig={mapConfig} />,
                <MapLegendSection mapConfig={mapConfig} />]
            }
        </div>
    }
}
