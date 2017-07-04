declare function require(name:string): any;
const owid: any = require('../owid').default
import * as _ from 'lodash'
import {observable, computed, action, autorun, toJS} from 'mobx'
import {ScaleType} from './AxisScale'
import {ComparisonLineConfig} from './ComparisonLine'
import {component} from './Util'
import AxisConfig, {AxisConfigProps} from './AxisConfig'
import ChartType, {ChartTypeType} from './ChartType'
import EntityKey from './EntityKey'
import ChartTabOption from './ChartTabOption'
import LineType from './LineType'
import {defaultTo} from './Util'
import VariableData from './VariableData'
import ChartData from './ChartData'
import MapConfig, {MapConfigProps} from './MapConfig'

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

// WIP
export class ChartConfigProps {
    @observable.ref id: number
    @observable.ref type: ChartTypeType = "LineChart"
    @observable.ref slug?: string = undefined
    @observable.ref title?: string = undefined
    @observable.ref subtitle?: string = undefined
    @observable.ref sourceDesc?: string = undefined
    @observable.ref note?: string = undefined

    @observable.ref xAxis: AxisConfigProps = new AxisConfigProps()
    @observable.ref yAxis: AxisConfigProps = new AxisConfigProps()

    @observable.struct selectedEntities: EntityKey[] = []
    @observable.struct timeDomain: [number|null, number|null]
    @observable.struct entityColors: {[key: string]: string} = {}

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

// In-progress mobx model layer that will eventually replace ChartModel
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
    @computed get selectedEntities() { return this.props.selectedEntities }
    @computed get timeDomain() { return this.props.timeDomain }
    @computed get entityColors() { return this.props.entityColors }
    @computed get tab() { return this.props.tab }
    @computed get lineType() { return defaultTo(this.props.lineType, LineType.WithDots) }
    @computed get lineTolerance() { return defaultTo(this.props.lineTolerance, 1) }
    @computed get addCountryMode() { return this.props.addCountryMode }
    @computed get comparisonLine() { return this.props.comparisonLine }
    @computed get highlightToggle() { return this.props.highlightToggle }
    @computed get timeline() { return this.props.timeline }

    set timeDomain(value) { this.props.timeDomain = value }
    set tab(value) { this.props.tab = value }
    set selectedEntities(value) { this.props.selectedEntities = value }

    xAxis: AxisConfig
    yAxis: AxisConfig

    @observable.ref variableCacheTag: string

    vardata: VariableData
    data: ChartData

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


    @computed get dimensions() {
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

    @computed get dimensionsWithData() {
        if (!this.vardata.isReady) return null

        return _.map(this.dimensions, dim => {
            const variable = this.vardata.variablesById[dim.variableId]
            return _.extend({}, dim, {
                displayName: dim.displayName || variable.name,
                variable: variable
            })
        })
    }

	model: any

    @computed get selectedEntitiesByKey() {
        return _.keyBy(this.selectedEntities)
    }

    @computed get availableTabs(): ChartTabOption[] {
        return _.filter([this.props.hasChartTab && 'chart', this.props.hasMapTab && 'map', 'data', 'sources']) as ChartTabOption[]
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

        this.props.selectedEntities = props['selected-countries'].map((e: any) => e.name)
        this.props.entityColors = {}
        props['selected-countries'].forEach((e: any) => {
            if (e.color)
                this.props.entityColors[e.name] = e.color
        })
        this.props.timeline = props['timeline']

        const timeDomain = props['chart-time']
        if (!timeDomain)
            this.props.timeDomain = [null, null]
        else
            this.props.timeDomain = (_.map(timeDomain, v => _.isString(v) ? parseInt(v) : v) as [number|null, number|null])


        this.props.hasChartTab = props['tabs'].includes("chart")
        this.props.hasMapTab = props['tabs'].includes("map")

        this.props.xAxis = props['xAxis']
        this.props.yAxis = props['yAxis']

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

	constructor(props: ChartConfigProps) {        
        this.xAxis = new AxisConfig()
        this.yAxis = new AxisConfig()
        this.update(props)
        this.vardata = new VariableData(this)
        this.data = new ChartData(this, this.vardata)
        
        window.chart = this
        
        // TODO fix this. Colors shouldn't be part of selectedEntities
		/*autorun(() => {
			const entities = this.selectedEntities
            const byName = _.keyBy(this.model.get('selected-countries'), 'name')

			if (window.chart && window.chart.vardata) {
				const entityKey = window.chart.vardata.get('entityKey')
                if (!_.isEmpty(entityKey)) {
                    const selectedEntities = _.filter(_.values(entityKey), e => _.includes(entities, e.name))                    
                    _.each(selectedEntities, e => {
                        if (byName[e.name])
                            _.extend(e, byName[e.name])
                    })
                    this.model.set('selected-countries', selectedEntities)
                }
			}
		})*/

	}
}
