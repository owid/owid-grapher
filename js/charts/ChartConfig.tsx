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
import ChartData from './ChartData'
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
    isProjection?: boolean,
    order: number,
    property: string,
    targetYear?: number,
    tolerance?: number,
    unit?: string
}

export interface DimensionSlot {
    property: string
    name: string
    allowMultiple?: boolean,
    dimensions: ChartDimension[]
}

export interface EntitySelection {
    entityId: number,
    index: number, // Which dimension the entity is from
    color?: Color
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
    @observable.ref addCountryMode: 'add-country'|'change-country'|'disabled' = 'add-country'

    @observable.ref timeline?: TimelineConfig = undefined
    @observable.ref comparisonLine?: ComparisonLineConfig = undefined
    @observable.ref highlightToggle: HighlightToggleConfig|undefined
    @observable.ref lineType: LineType = LineType.WithDots
    @observable.ref lineTolerance?: number = undefined
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
    @computed get slug() { return defaultTo(this.props.slug, "") }
    @computed get title() { return defaultTo(this.props.title, "") }
    @computed get subtitle() { return defaultTo(this.props.subtitle, "") }
    @computed get sourceDesc() { return defaultTo(this.props.sourceDesc, "") }
    @computed get note() { return defaultTo(this.props.note, "") }
    @computed get internalNotes() { return defaultTo(this.props.internalNotes, "") }
    @computed get logosSVG() { return this.props.logosSVG }
    @computed get originUrl() { return defaultTo(this.props.originUrl, "") }
    @computed get isPublished() { return defaultTo(this.props.isPublished, false) }
    @computed get primaryTab() { return this.props.tab }
    @computed get overlayTab() { return this.props.overlay }
    @computed get tab() { return this.props.overlay ? this.props.overlay : this.props.tab }
    @computed get lineType() { return defaultTo(this.props.lineType, LineType.WithDots) }
    @computed get lineTolerance() { return defaultTo(this.props.lineTolerance, 1) }
    @computed get addCountryMode() { return this.props.addCountryMode }
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
	@computed get emptyDimensionSlots(): DimensionSlot[] {
		const xAxis = { property: 'x', name: 'X axis', dimensions: [] }
		const yAxis = { property: 'y', name: 'Y axis', dimensions: [] }
		const color = { property: 'color', name: 'Color', dimensions: [] }
		const size = { property: 'size', name: 'Size', dimensions: [] }
        
        let slots = []
		if (this.type == ChartType.ScatterPlot)
			slots = [yAxis, xAxis, size, color];
		else if (this.type == ChartType.SlopeChart)
			slots = [yAxis, size, color]
		else
		    slots = [{ property: 'y', name: 'Y axis', allowMultiple: true, dimensions: [] }];
        
        return slots
	}

    @computed get dimensions(): ChartDimension[] {
        const dimensions = _.map(this.props.dimensions, _.clone)
        const validProperties = _.map(this.emptyDimensionSlots, 'property')
        let validDimensions = _.filter(dimensions, dim => _.includes(validProperties, dim.property))

		// Give scatterplots a default color and size dimension if they don't have one
		if ((this.type == ChartType.ScatterPlot || this.type == ChartType.SlopeChart) && !_.find(dimensions, { property: 'color' })) {
			validDimensions = validDimensions.concat([{ variableId: 123, property: "color", tolerance: 5, order: 0 }]);
		}

		if ((this.type == ChartType.ScatterPlot || this.type == ChartType.SlopeChart) && !_.find(dimensions, { property: 'size' })) {
			validDimensions = validDimensions.concat([{ variableId: 72, property: "size", tolerance: 5, order: 0 }]);
		}

        return validDimensions
    }

	model: any

    @computed get availableTabs(): ChartTabOption[] {
        return _.filter([this.props.hasChartTab && 'chart', this.props.hasMapTab && 'map', 'data', 'sources', 'download']) as ChartTabOption[]
    }

    @action.bound update(props: any) {
        this.props.id = props['id']
        if (props['chart-type']) this.props.type = props['chart-type']
        this.props.slug = props['slug']
        this.props.title = props['title']
        this.props.subtitle = props['subtitle']
        this.props.sourceDesc = props['sourceDesc']
        this.props.note = props['chart-description']
        this.props.internalNotes = props['internalNotes']
        this.props.logosSVG = props['logosSVG']
        this.props.originUrl = props['data-entry-url']
        this.props.isPublished = props['published']
        this.props.map = props['map-config'] ? _.extend(new MapConfigProps(), props['map-config']) : undefined

        this.props.selectedData = props['selectedData']
        this.props.timeline = props['timeline']

        this.props.minTime = props['minTime']
        this.props.maxTime = props['maxTime']
        this.props.entityType = props['entity-type']
        
        this.props.hasChartTab = props['tabs'] ? props['tabs'].includes("chart") : true
        this.props.hasMapTab = props['tabs'] ? props['tabs'].includes("map") : false

        _.extend(this.props.xAxis, props['xAxis'])
        _.extend(this.props.yAxis, props['yAxis'])

        this.props.dimensions = props['chart-dimensions'] 
        this.props.addCountryMode = props['add-country-mode']
        this.props.comparisonLine = props["comparisonLine"]
        this.props.highlightToggle = props["highlightToggle"]
        this.props.tab = props["default-tab"]

        this.props.lineType = props["line-type"]
        this.props.lineTolerance = parseInt(props["line-tolerance"]) || 1
        this.props.hideLegend = props["hide-legend"]
        this.props.hideRelativeToggle = props["hide-toggle"]
        this.props.stackMode = props["currentStackMode"]
        
        this.variableCacheTag = props["variableCacheTag"]
    }

    @computed.struct get json() {
        const {props} = this

        const json: any = toJS(this.props)

        // XXX backwards compatibility
        json['chart-type'] = props.type
        json['chart-description'] = props.note
        json['published'] = props.isPublished
        json['map-config'] = props.map
        json['tabs'] = this.availableTabs
        json['chart-dimensions'] = props.dimensions
        json['add-country-mode'] = props.addCountryMode
        json['default-tab'] = props.tab
        json['line-type'] = props.lineType
        json['line-tolerance'] = props.lineTolerance
        json['hide-legend'] = props.hideLegend
        json['hide-toggle'] = props.hideRelativeToggle
        json['entity-type'] = props.entityType

        return json
    }

    @computed get map() { return new MapConfig(this) }
    @computed get discreteBar() { return new DiscreteBarTransform(this) }
    @computed get stackedArea() { return new StackedAreaTransform(this) }
    @computed get lineChart() { return new LineChartTransform(this) }
    @computed get scatter() { return new ScatterTransform(this) }
    @computed get slopeChart() { return new SlopeChartTransform(this) }

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

    // TODO - make these unnecessary
	@computed get isMultiEntity() {
        if (this.data.selectedKeys.length > 1)
            return true
        else if (this.addCountryMode == "add-country")
            return true
		else
			return false;
	}

    @computed get isMultiVariable() {
        return this.dimensions.length > 1
    }

    @computed get staticSVG(): string {
        const svg = ReactDOMServer.renderToStaticMarkup(<ChartView
            chart={this}
            isExport={true}
            bounds={new Bounds(0, 0, App.IDEAL_WIDTH, App.IDEAL_HEIGHT)}/>)

        return svg
    }

    @computed get isScatter() { return this.type == ChartType.ScatterPlot }
    @computed get isStackedArea() { return this.type == ChartType.StackedArea }
}
