declare function require(name:string): any;
const owid: any = require('../owid').default
import * as _ from 'lodash'
import {observable, computed, action, autorun, toJS} from 'mobx'
import {ScaleType} from './AxisScale'
import {ComparisonLineConfig} from './ComparisonLine'
import {component} from './Util'
import AxisConfig from './AxisConfig'

export interface TimelineConfig {
    compareEndPointsOnly?: boolean
}

// In-progress mobx model layer that will eventually replace ChartModel
export default class ChartConfig {
    @observable.ref type: string
    @observable.ref slug: string
    @observable.ref title: string
    @observable.ref subtitle: string
    @observable.ref sourceDesc: string
    @observable.ref note: string
    @observable.ref internalNotes: string
    @observable.ref logosSVG: string[]
    @observable.ref originUrl: string
    @observable.ref isPublished: boolean

	@observable.ref selectedEntities: Object[] = []
    @observable.ref entityType: string = "country"
    @observable.ref timeDomain: [number|null, number|null]
    @observable.ref timeline: TimelineConfig|null = null
    @observable.ref entityColors: {[key: string]: string} = {}

    xAxis: AxisConfig

    yAxis: AxisConfig

    @observable.ref units: Object[]
    @observable.struct availableTabs: string[]

    @observable.struct dimensions: Object[]
    @observable.ref dimensionsWithData: Object[]
    @observable.ref addCountryMode: 'add-country'|'change-country'|'disabled' = 'add-country'
    @observable.ref comparisonLine: ComparisonLineConfig|null

	model: any

    @computed get selectedEntitiesByName() {
        return _.keyBy(this.selectedEntities)
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
        this.entityType = this.model.get('entity-type')
        this.timeline = this.model.get('timeline')

        const timeDomain = this.model.get('chart-time')
        if (!timeDomain)
            this.timeDomain = [null, null]
        else
            this.timeDomain = _.map(timeDomain, v => _.isString(v) ? parseInt(v) : v)

        this.units = JSON.parse(this.model.get('units')||"{}")

        const yAxis = this.model.get('y-axis')||{}        

        this.yAxis = component(this.yAxis, AxisConfig, { props: {
            label: yAxis["axis-label"],
            min: yAxis["axis-min"],
            max: yAxis["axis-max"],
            prefix: yAxis["axis-prefix"],
            suffix: yAxis["axis-suffix"],
            scaleType: yAxis["axis-scale"],
            canChangeScaleType: this.model.get("y-axis-scale-selector"),
            numDecimalPlaces: yAxis["axis-format"]
        }});

        const xAxis = this.model.get('x-axis')||{}        

        this.xAxis = component(this.xAxis, AxisConfig, { props: {
            label: xAxis["axis-label"],
            min: xAxis["axis-min"],
            max: xAxis["axis-max"],
            prefix: xAxis["axis-prefix"],
            suffix: xAxis["axis-suffix"],
            scaleType: xAxis["axis-scale"],
            canChangeScaleType: this.model.get("y-axis-scale-selector"),
            numDecimalPlaces: xAxis["axis-format"]
        }});

        this.availableTabs = (_.sortBy(this.model.get('tabs'), name => {
            if (name == 'chart')
                return 1
            else if (name == 'map')
                return 2
            else
                return 3
        }) as string[])

        this.dimensions = this.model.get('chart-dimensions')        
        this.addCountryMode = this.model.get('add-country-mode')
        this.comparisonLine = this.model.get("comparisonLine")
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
            this.model.setAxisConfig('y-axis', 'axis-scale', this.yScaleType)
        })

        autorun(() => {
            this.model.setAxisConfig('x-axis', 'axis-scale', this.xScaleType)
        })
	}
}
