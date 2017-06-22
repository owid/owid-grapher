declare function require(name:string): any;
const owid: any = require('../owid').default
import * as _ from 'lodash'
import {observable, computed, action, autorun, toJS} from 'mobx'
import {ScaleType} from './AxisScale'
import {ComparisonLineConfig} from './ComparisonLine'
import {component} from './Util'
import AxisConfig from './AxisConfig'
import {ChartTypeType} from './ChartType'
import EntityKey from './EntityKey'
import ChartTabOption from './ChartTabOption'
import LineType from './LineType'

export interface TimelineConfig {
    compareEndPointsOnly?: boolean
}

// WIP
export class ChartConfigProps {
    type: ChartTypeType = "LineChart"
    // Slug at which base chart can be found
    slug?: string
    // Chart title
    title?: string
    // Chart subtitle
    subtitle?: string
    // Override for source description text in footer
    sourceDesc?: string
    // Additional note text for footer
    note?: string
    // Internal notes for admin use
    internalNotes?: string
    // svg for logos in header
    logosSVG: string[]
    // OWID-specific: entry url where this chart is embedded
    originUrl: string
    // Whether the chart is publicly accessible
    isPublished?: true
    // List of active/selected entities to show
    selectedEntities: EntityKey[]    
}

// In-progress mobx model layer that will eventually replace ChartModel
export default class ChartConfig {
    @observable.ref type: ChartTypeType
    @observable.ref slug: string
    @observable.ref title: string
    @observable.ref subtitle: string
    @observable.ref sourceDesc: string
    @observable.ref note: string
    @observable.ref internalNotes: string
    @observable.ref logosSVG: string[]
    @observable.ref originUrl: string
    @observable.ref isPublished: boolean

	@observable.ref selectedEntities: EntityKey[] = []
    @observable.ref timeDomain: [number|null, number|null]
    @observable.ref timeline: TimelineConfig|null = null
    @observable.ref entityColors: {[key: string]: string} = {}
    @observable.ref tab: ChartTabOption

    // XXX special line chart stuff that should maybe go elsewhere
    @observable.ref lineType: LineType = LineType.WithDots
    @observable.ref lineTolerance: number = 1

    @observable.ref hasChartTab: boolean = true
    @observable.ref hasMapTab: boolean = false

    xAxis: AxisConfig
    yAxis: AxisConfig

    @observable.struct dimensions: Object[]
    @observable.ref dimensionsWithData: Object[]
    @observable.ref addCountryMode: 'add-country'|'change-country'|'disabled' = 'add-country'
    @observable.ref comparisonLine: ComparisonLineConfig|null

	model: any

    @computed get selectedEntitiesByName() {
        return _.keyBy(this.selectedEntities)
    }

    @computed get availableTabs(): ChartTabOption[] {
        return _.filter([this.hasChartTab && 'chart', this.hasMapTab && 'map', 'data', 'sources']) as ChartTabOption[]
    }

    @action.bound syncFromModel() {
        this.type = this.model.get('chart-type')
        this.slug = this.model.get('slug')
        this.title = this.model.get('title')
        this.subtitle = this.model.get('subtitle')
        this.sourceDesc = this.model.get('sourceDesc')
        this.note = this.model.get('chart-description')
        this.internalNotes = this.model.get('internalNotes')
        this.logosSVG = this.model.get('logosSVG')
        this.originUrl = this.model.get('data-entry-url')
        this.isPublished = this.model.get('published')

        this.selectedEntities = this.model.getSelectedEntities().map((e: any) => e.name)
        this.entityColors = {}
        _.each(this.model.getSelectedEntities(), e => {
            if (e.color)
                this.entityColors[e.name] = e.color
        })
        this.timeline = this.model.get('timeline')

        const timeDomain = this.model.get('chart-time')
        if (!timeDomain)
            this.timeDomain = [null, null]
        else
            this.timeDomain = (_.map(timeDomain, v => _.isString(v) ? parseInt(v) : v) as [number|null, number|null])

        this.yAxis = component(this.yAxis, AxisConfig, { props: this.model.get("yAxis") })
        this.xAxis = component(this.xAxis, AxisConfig, { props: this.model.get("xAxis") })

        this.hasChartTab = this.model.get('tabs').includes("chart")
        this.hasMapTab = this.model.get('tabs').includes("map")

        this.dimensions = this.model.get('chart-dimensions')        
        this.addCountryMode = this.model.get('add-country-mode')
        this.comparisonLine = this.model.get("comparisonLine")
        this.tab = this.model.get("default-tab")

        this.lineType = this.model.get("line-type")
        this.lineTolerance = parseInt(this.model.get("line-tolerance")) || 1
    }

	constructor(model : any, data: any) {
		this.model = model

        this.syncFromModel()
        this.model.on('change', this.syncFromModel)

        data.ready(() => {
            this.dimensionsWithData = this.model.getDimensions()
        })
        this.model.on('change:chart-dimensions change:chart-type', () => {
            data.ready(() => {
                this.dimensionsWithData = this.model.getDimensions()
            })
        })

        // TODO fix this. Colors shouldn't be part of selectedEntities
		autorun(() => {
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
		})

        autorun(() => {
            this.model.set({
                'chart-type': this.type,
                'slug': this.slug,
                'title': this.title,
                'subtitle': this.subtitle,
                'sourceDesc': this.sourceDesc,
                'chart-description': this.note,
                'internalNotes': this.internalNotes
            })
        })

		autorun(() => {
			this.model.set('timeline', toJS(this.timeline))
		})

        autorun(() => {
            this.model.set('chart-time', toJS(this.timeDomain))
        })

        autorun(() => {
            this.model.set('comparisonLine', toJS(this.comparisonLine))
        })

        autorun(() => {
            this.model.set('tabs', this.availableTabs)
        })

        autorun(() => {            
            this.model.set('xAxis', toJS(this.xAxis.props))
        })

        autorun(() => {
            this.model.set('yAxis', toJS(this.yAxis.props))
        })

        autorun(() => { this.model.set('default-tab', this.tab) })
	}
}
