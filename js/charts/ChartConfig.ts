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
import Color from './Color'

export interface TimelineConfig {
    compareEndPointsOnly?: boolean
}

export interface HighlightToggleConfig {
    description: string
    paramStr: string
}

export interface ChartDimension {
    id: number,
    variableId: number,
    color: string,
    displayName: string,    
    isProjection: boolean,
    order: number,
    property: string,
    targetYear: number|null,
    tolerance: number,
    unit: string
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
    @observable.struct timeDomain: [number|null, number|null]
    @observable.struct keyColors: {[key: string]: string} = {}

    @observable.struct dimensions: ChartDimension[] = []
    @observable.ref addCountryMode: 'add-country'|'change-country'|'disabled' = 'add-country'

    // XXX special line chart stuff that should maybe go elsewhere
    @observable.ref timeline?: TimelineConfig = undefined
    @observable.ref comparisonLine?: ComparisonLineConfig = undefined
    @observable.ref highlightToggle: HighlightToggleConfig|undefined
    @observable.ref lineType: LineType = LineType.WithDots
    @observable.ref lineTolerance?: number = undefined
    @observable.ref stackMode: string = 'expanded'

    @observable.ref hasChartTab: boolean = true
    @observable.ref hasMapTab: boolean = false
    @observable.ref tab: ChartTabOption = 'chart'

    @observable.ref internalNotes?: string = undefined
    @observable.ref logosSVG: string[] = []
    @observable.ref originUrl?: string = undefined
    @observable.ref isPublished?: true = undefined

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
    @computed get timeDomain() { return this.props.timeDomain }
    @computed get keyColors() { return this.props.keyColors }
    @computed get tab() { return this.props.tab }
    @computed get lineType() { return defaultTo(this.props.lineType, LineType.WithDots) }
    @computed get lineTolerance() { return defaultTo(this.props.lineTolerance, 1) }
    @computed get addCountryMode() { return this.props.addCountryMode }
    @computed get comparisonLine() { return this.props.comparisonLine }
    @computed get highlightToggle() { return this.props.highlightToggle }
    @computed get timeline() { return this.props.timeline }
    @computed get hasChartTab() { return this.props.hasChartTab }
    @computed get hasMapTab() { return this.props.hasMapTab }

    set timeDomain(value) { this.props.timeDomain = value }
    set tab(value) { this.props.tab = value }

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
    colors: ColorBinder

	// Get the empty dimension slots appropriate for this type of chart
	@computed get emptyDimensions() {
		let xAxis = { property: 'x', name: 'X axis' },
			yAxis = { property: 'y', name: 'Y axis' },
			color = { property: 'color', name: 'Color' },
			size = { property: 'size', name: 'Size' };

		if (this.type == ChartType.ScatterPlot)
			return [xAxis, yAxis, size, color];
		else if (this.type == ChartType.SlopeChart)
			return [yAxis, size, color]
		else
			return [yAxis];
	}


    @computed get dimensions(): ChartDimension[] {
        const dimensions = _.map(this.props.dimensions, _.clone)
        const validProperties = _.map(this.emptyDimensions, 'property')
        let validDimensions = _.filter(dimensions, dim => _.includes(validProperties, dim.property))

		// Give scatterplots a default color and size dimension if they don't have one
		if ((this.type == ChartType.ScatterPlot || this.type == ChartType.SlopeChart) && !_.find(dimensions, { property: 'color' })) {
			validDimensions = validDimensions.concat([{"variableId":"123","property":"color","unit":"","name":"Color","tolerance":"5"}]);
		}

		if ((this.type == ChartType.ScatterPlot || this.type == ChartType.SlopeChart) && !_.find(dimensions, { property: 'size' })) {
			validDimensions = validDimensions.concat([{"variableId":"72","property":"size","unit":"","name":"Size","tolerance":"5"}]);
		}

        return validDimensions
    }

    @computed get primaryDimensions() {
		return this.dimensions.filter(dim => dim.property == 'y')        
    }

	model: any

    @computed get availableTabs(): ChartTabOption[] {
        return _.filter([this.props.hasChartTab && 'chart', this.props.hasMapTab && 'map', 'data', 'sources', 'download']) as ChartTabOption[]
    }

    @action.bound update(props: any) {
        this.props.id = props['id']
        this.props.type = props['chart-type']
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

        const timeDomain = props['chart-time']
        if (!timeDomain)
            this.props.timeDomain = [null, null]
        else
            this.props.timeDomain = (_.map(timeDomain, v => _.isString(v) ? parseInt(v) : v) as [number|null, number|null])


        this.props.hasChartTab = props['tabs'].includes("chart")
        this.props.hasMapTab = props['tabs'].includes("map")

        _.extend(this.props.xAxis, props['xAxis'])
        _.extend(this.props.yAxis, props['yAxis'])

        this.props.dimensions = props['chart-dimensions'] 
        this.props.addCountryMode = props['add-country-mode']
        this.props.comparisonLine = props["comparisonLine"]
        this.props.highlightToggle = props["highlightToggle"]
        this.props.tab = props["default-tab"]

        this.props.lineType = props["line-type"]
        this.props.lineTolerance = parseInt(props["line-tolerance"]) || 1
        
        this.variableCacheTag = props["variableCacheTag"]
    }

    @computed get map() {
        return this.props.hasMapTab && new MapConfig(this)
    }

    @computed.struct get json() {
        const {props} = this

        const json: any = toJS(this.props)

        // XXX backwards compatibility
        json['chart-type'] = props.type
        json['chart-description'] = props.note
        json['published'] = props.isPublished
        json['map-config'] = props.map
        json['selectedData'] = props.selectedData
        json['chart-time'] = props.timeDomain
        json['tabs'] = this.availableTabs
        json['chart-dimensions'] = props.dimensions
        json['add-country-mode'] = props.addCountryMode
        json['default-tab'] = props.tab
        json['line-type'] = props.lineType
        json['line-tolerance'] = props.lineTolerance

        return json
    }

    @computed get discreteBar() { return new DiscreteBarTransform(this) }

	constructor(props: ChartConfigProps) {        
        this.update(props)
        this.vardata = new VariableData(this)
        this.data = new ChartData(this, this.vardata)
        this.url = new URLBinder(this)
        this.colors = new ColorBinder(this)

        window.chart = this

        // Sanity check configuration
        autorun(() => {
            if (!_.includes(this.availableTabs, this.props.tab)) {
                runInAction(() => this.props.tab = this.availableTabs[0])
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
}
