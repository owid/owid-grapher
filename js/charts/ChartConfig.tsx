declare function require(name:string): any;
const owid: any = require('../owid').default
import * as _ from 'lodash'
import {observable, computed, action, autorun, toJS, runInAction} from 'mobx'
import {ScaleType} from './AxisScale'
import {ComparisonLineConfig} from './ComparisonLine'
import {component} from './Util'
import AxisConfig, {AxisConfigProps} from './AxisConfig'
import ChartType, {ChartTypeType} from './ChartType'
import DataKey from './DataKey'
import ChartTabOption from './ChartTabOption'
import LineType from './LineType'
import {defaultTo} from './Util'
import VariableData from './VariableData'
import ChartData, {DimensionWithData} from './ChartData'
import MapConfig, {MapConfigProps} from './MapConfig'
import URLBinder from './URLBinder'
import ColorBinder from './ColorBinder'
import DiscreteBarTransform from './DiscreteBarTransform'
import StackedAreaTransform from './StackedAreaTransform'
import LineChartTransform from './LineChartTransform'
import ScatterTransform from './ScatterTransform'
import SlopeChartTransform from './SlopeChartTransform'
import Color from './Color'
import ChartView from './ChartView'
import * as React from 'react'
import * as ReactDOMServer from 'react-dom/server'
import Bounds from './Bounds'
import IChartTransform from './IChartTransform'

declare const App: any
declare const window: any

export interface TimelineConfig {
    compareEndPointsOnly?: boolean
}

export interface HighlightToggleConfig {
    description: string
    paramStr: string
}

export interface ChartDimension {
    id?: number,
    variableId: number,
    color?: string,
    displayName?: string,    
    isProjection?: true,
    order: number,
    property: string,
    targetYear?: number,
    tolerance?: number,
    unit?: string
}

export interface EntitySelection {
    entityId: number,
    index: number, // Which dimension the entity is from
    color?: Color
}

export class DimensionSlot {
    chart: ChartConfig
    property: string
    constructor(chart: ChartConfig, property: string) {
        this.chart = chart
        this.property = property
    }

    @computed get name(): string {
        const names = {
            'y': 'Y axis',
            'x': 'X axis',
            'size': 'Size',
            'color': 'Color'
        }

        return (names as any)[this.property]||""
    }

    @computed get allowMultiple(): boolean {
        return this.property == 'y' && !(this.chart.isScatter || this.chart.isSlopeChart)
    }

    @computed get dimensions(): ChartDimension[] {
        return this.chart.dimensions.filter(d => d.property == this.property)
    }

    @computed get dimensionsWithData(): DimensionWithData[] {
        return this.chart.data.filledDimensions.filter(d => d.property == this.property)
    }

    set dimensions(dims: ChartDimension[]) {
        let newDimensions: ChartDimension[] = []
        this.chart.dimensionSlots.forEach(slot => {
            if (slot.property == this.property)
                newDimensions = newDimensions.concat(dims)
            else
                newDimensions = newDimensions.concat(slot.dimensions)
        })
        this.chart.props.dimensions = newDimensions
    }

    createDimension(variableId: number) {
        return { property: this.property, variableId: variableId, order: 0 }
    }
}

export class ChartConfigProps {
    @observable.ref id: number|undefined = undefined
    @observable.ref type: ChartTypeType = "LineChart"
    @observable.ref slug?: string = undefined
    @observable.ref title?: string = undefined
    @observable.ref subtitle?: string = undefined
    @observable.ref sourceDesc?: string = undefined
    @observable.ref note?: string = undefined

    @observable.ref xAxis: AxisConfigProps = new AxisConfigProps()
    @observable.ref yAxis: AxisConfigProps = new AxisConfigProps()

    @observable.ref selectedData: EntitySelection[] = []
    @observable.ref minTime?: number = undefined
    @observable.ref maxTime?: number = undefined

    @observable.struct dimensions: ChartDimension[] = []
    @observable.ref addCountryMode?: 'add-country'|'change-country'|'disabled' = undefined

    @observable.ref timeline?: TimelineConfig = undefined
    @observable.ref comparisonLine?: ComparisonLineConfig = undefined
    @observable.ref highlightToggle?: HighlightToggleConfig = undefined
    @observable.ref stackMode: string = 'absolute'
    @observable.ref hideLegend?: true = undefined
    @observable.ref hideRelativeToggle?: true = undefined
    @observable.ref entityType?: string = undefined

    @observable.ref hasChartTab: boolean = true
    @observable.ref hasMapTab: boolean = false
    @observable.ref tab: ChartTabOption = 'chart'
    @observable.ref overlay?: ChartTabOption = undefined

    @observable.ref internalNotes?: string = undefined
    @observable.ref logosSVG: string[] = []
    @observable.ref originUrl?: string = undefined
    @observable.ref isPublished?: true = undefined
    @observable.ref baseColorScheme?: string = undefined

    @observable map?: MapConfigProps = undefined
}

export default class ChartConfig {
    props: ChartConfigProps = new ChartConfigProps()

    @computed get id() { return this.props.id }
    @computed get type() { return this.props.type }
    @computed get subtitle() { return defaultTo(this.props.subtitle, "") }
    @computed get note() { return defaultTo(this.props.note, "") }
    @computed get internalNotes() { return defaultTo(this.props.internalNotes, "") }
    @computed get logosSVG() { return this.props.logosSVG }
    @computed get originUrl() { return defaultTo(this.props.originUrl, "") }
    @computed get isPublished() { return defaultTo(this.props.isPublished, false) }
    @computed get primaryTab() { return this.props.tab }
    @computed get overlayTab() { return this.props.overlay }
    @computed get tab() { return this.props.overlay ? this.props.overlay : this.props.tab }
    @computed get addCountryMode() { return this.props.addCountryMode||"add-country" }
    @computed get comparisonLine() { return this.props.comparisonLine }
    @computed get highlightToggle() { return this.props.highlightToggle }
    @computed get timeline() { return this.props.timeline }
    @computed get hasChartTab() { return this.props.hasChartTab }
    @computed get hasMapTab() { return this.props.hasMapTab }
    @computed get hideLegend() { return this.props.hideLegend }
    @computed get baseColorScheme() { return this.props.baseColorScheme }

    @computed get entityType() { return this.props.entityType||"country" }
    
    @computed get timeDomain(): [number|null, number|null] {
        return [this.props.minTime||null, this.props.maxTime||null]
    }

    set timeDomain(value: [number|null, number|null]) { 
        this.props.minTime = value[0]||undefined
        this.props.maxTime = value[1]||undefined
    }
    
    set tab(value) { 
        if (value == 'chart' || value == 'map') {
            this.props.tab = value
            this.props.overlay = undefined
        } else {
            this.props.overlay = value
        }
    }

    @computed get xAxis() {
        return new AxisConfig(this.props.xAxis)
    }

    @computed get yAxis() {
        return new AxisConfig(this.props.yAxis)
    }

    @observable.ref variableCacheTag: string
    @observable.ref tooltip: React.ReactNode

    vardata: VariableData
    data: ChartData
    url: URLBinder

	// Get the dimension slots appropriate for this type of chart
	@computed get dimensionSlots(): DimensionSlot[] {
		const xAxis = new DimensionSlot(this, 'x')
        const yAxis = new DimensionSlot(this, 'y')
        const color = new DimensionSlot(this, 'color')
        const size = new DimensionSlot(this, 'size')

		if (this.isScatter)
			return [yAxis, xAxis, size, color]
		else if (this.isSlopeChart)
			return [yAxis, size, color]
		else
		    return [yAxis]
	}

    @computed get dimensions(): ChartDimension[] {
        const dimensions = _.map(this.props.dimensions, _.clone)
        const validProperties = _.map(this.dimensionSlots, 'property')
        let validDimensions = _.filter(dimensions, dim => _.includes(validProperties, dim.property))

        this.dimensionSlots.forEach(slot => {
            if (!slot.allowMultiple)
                validDimensions = _.uniqWith(validDimensions, (a: ChartDimension, b: ChartDimension) => a.property == slot.property && a.property == b.property)
        })
    
		// Give scatterplots and slope charts a default color and size dimension if they don't have one
		if ((this.isScatter || this.isSlopeChart) && !_.find(dimensions, { property: 'color' })) {
			validDimensions = validDimensions.concat([{ variableId: 123, property: "color", tolerance: 5, order: 0 }]);
		}

		if ((this.isScatter || this.isSlopeChart) && !_.find(dimensions, { property: 'size' })) {
			validDimensions = validDimensions.concat([{ variableId: 72, property: "size", tolerance: 5, order: 0 }]);
		}

        return validDimensions
    }

	model: any

    @computed get availableTabs(): ChartTabOption[] {
        return _.filter([this.props.hasChartTab && 'chart', this.props.hasMapTab && 'map', 'data', 'sources', 'download']) as ChartTabOption[]
    }

    @action.bound update(props: any) {
        for (let key in this.props) {
            if (key in props && key != 'xAxis' && key != 'yAxis') {
                (this.props as any)[key] = props[key]
            }
        }
        
        if (props.isAutoTitle)
            this.props.title = undefined

        // Note: no auto slug outside of editor for obvious reasons
        if (props.isAutoSlug && App.isEditor)
            this.props.slug = undefined

        this.props.type = props['chart-type']||ChartType.LineChart
        this.props.note = props['chart-description']
        this.props.originUrl = props['data-entry-url']
        this.props.isPublished = props['published']
        this.props.map = props['map-config'] ? _.extend(new MapConfigProps(), props['map-config']) : undefined        
        this.props.hasChartTab = props['tabs'] ? props['tabs'].includes("chart") : true
        this.props.hasMapTab = props['tabs'] ? props['tabs'].includes("map") : false
        _.extend(this.props.xAxis, props['xAxis'])
        _.extend(this.props.yAxis, props['yAxis'])

        this.props.dimensions = props['chart-dimensions']||this.props.dimensions
        this.props.addCountryMode = props['add-country-mode']
        this.props.tab = props["default-tab"]
        this.props.hideLegend = props["hide-legend"]
        this.props.hideRelativeToggle = props["hide-toggle"]
        this.props.stackMode = props["currentStackMode"]||this.props.stackMode
        
        this.variableCacheTag = props["variableCacheTag"]
    }

    @computed.struct get json() {
        const {props} = this

        const json: any = toJS(this.props)

        // Chart title and slug may be autocalculated from data, in which case they won't be in props
        // But the server will need to know what we calculated in order to do its job
        if (!this.props.title) {
            json.title = this.data.title
            json.isAutoTitle = true
        }
        if (!this.props.slug) {
            json.slug = this.data.slug
            json.isAutoSlug = true
        }

        // XXX backwards compatibility
        json['chart-type'] = props.type
        json['chart-description'] = props.note
        json['published'] = props.isPublished
        json['map-config'] = props.map
        json['tabs'] = this.availableTabs
        json['chart-dimensions'] = props.dimensions
        json['add-country-mode'] = props.addCountryMode
        json['default-tab'] = props.tab
        json['hide-legend'] = props.hideLegend
        json['hide-toggle'] = props.hideRelativeToggle
        json['entity-type'] = props.entityType

        return json
    }

    @computed get isLineChart() { return this.type == ChartType.LineChart }
    @computed get isScatter() { return this.type == ChartType.ScatterPlot }
    @computed get isStackedArea() { return this.type == ChartType.StackedArea }
    @computed get isSlopeChart() { return this.type == ChartType.SlopeChart }
    @computed get isDiscreteBar() { return this.type == ChartType.DiscreteBar }

    @computed get lineChart() { return new LineChartTransform(this) }
    @computed get scatter() { return new ScatterTransform(this) }
    @computed get stackedArea() { return new StackedAreaTransform(this) }
    @computed get slopeChart() { return new SlopeChartTransform(this) }
    @computed get discreteBar() { return new DiscreteBarTransform(this) }
    @computed get map() { return new MapConfig(this) }

    @computed get activeTransform(): IChartTransform {
        if (this.isLineChart)
            return this.lineChart
        else if (this.isScatter)
            return this.scatter
        else if (this.isStackedArea)
            return this.stackedArea
        else if (this.isSlopeChart)
            return this.slopeChart
        else if (this.isDiscreteBar)
            return this.discreteBar
        else
            throw "No transform found"
    }

	constructor(props: ChartConfigProps) {        
        this.update(props)
        this.vardata = new VariableData(this)
        this.data = new ChartData(this)
        this.url = new URLBinder(this)

        window.chart = this

        // Sanity check configuration
        autorun(() => {
            if (!_.includes(this.availableTabs, this.props.tab)) {
                runInAction(() => this.props.tab = this.availableTabs[0])
            }
        })

        autorun(() => {
            if (this.props.hasMapTab && !this.props.map) {
                runInAction(() => this.props.map = new MapConfigProps())
            }
        })
	}

    @computed get staticSVG(): string {
        const svg = ReactDOMServer.renderToStaticMarkup(<ChartView
            chart={this}
            isExport={true}
            bounds={new Bounds(0, 0, App.IDEAL_WIDTH, App.IDEAL_HEIGHT)}/>)

        return svg
    }
}
